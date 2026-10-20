import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => {
  class MockRequestAuthError extends Error { status: 401 | 403 | 503; constructor(message: string, status: 401 | 403 | 503) { super(message); this.status = status } }
  return {
    send: vi.fn(),
    ipLimited: vi.fn(() => false),
    uidLimited: vi.fn(() => false),
    requireCustomer: vi.fn(),
    getDb: vi.fn(),
    MockRequestAuthError,
  }
})
vi.mock('resend', () => ({ Resend: class { emails = { send: mocks.send } } }))
vi.mock('@/lib/auth/contactFormRateLimit', () => ({ isDeletionRequestRateLimited: mocks.ipLimited, isDeletionRequestUidRateLimited: mocks.uidLimited }))
vi.mock('@/lib/firebase/verifyRequestUser', () => ({ requireCustomer: mocks.requireCustomer, RequestAuthError: mocks.MockRequestAuthError }))
vi.mock('@/lib/firebase/admin', () => ({ getAdminDb: mocks.getDb }))

import { OPTIONS, POST } from '@/app/api/account/delete-request/route'
import { buildDeletionRequestEmail, parseDeletionRequest, type DeletionRequestEmail } from '@/lib/email/sendDeletionRequest'
import { DELETION_DEDUPE_MS } from '@/lib/account/deletionRequests'
import { DELETION_DETAILS_MAX, DELETION_REASONS, DELETION_REASON_KEYS } from '@/lib/account/deletionReasons'
import { translations } from '@/lib/i18n/translations'

// Just enough Firestore for the route: doc get/set/delete and a transaction
// with get + set. failTransaction makes every transaction throw.
class FakeDb {
  docs = new Map<string, Record<string, unknown>>()
  failTransaction = false
  private ref(path: string) {
    return {
      path,
      get: async () => ({ exists: this.docs.has(path), data: () => this.docs.get(path) }),
      set: async (v: Record<string, unknown>) => { this.docs.set(path, v) },
      delete: async () => { this.docs.delete(path) },
    }
  }
  collection(name: string) { return { doc: (id: string) => this.ref(`${name}/${id}`) } }
  async runTransaction<T>(work: (tx: unknown) => Promise<T>): Promise<T> {
    if (this.failTransaction) throw new Error('unavailable')
    const writes: [string, Record<string, unknown>][] = []
    const tx = {
      get: async (ref: { path: string }) => ({ exists: this.docs.has(ref.path), data: () => this.docs.get(ref.path) }),
      set: (ref: { path: string }, v: Record<string, unknown>) => { writes.push([ref.path, v]) },
    }
    const result = await work(tx)
    for (const [path, v] of writes) this.docs.set(path, v)
    return result
  }
}

const token = {
  uid: 'user-1',
  email: 'dana@example.com',
  name: 'Token Name',
  firebase: { identities: { email: ['dana@example.com'], 'google.com': ['123'] }, sign_in_provider: 'google.com' },
}

let db: FakeDb
beforeEach(() => {
  vi.clearAllMocks()
  vi.stubEnv('EMAIL_FROM', 'test@landly.test')
  vi.stubEnv('RESEND_API_KEY', 'fake-test-key')
  mocks.send.mockResolvedValue({ error: null })
  mocks.ipLimited.mockReturnValue(false)
  mocks.uidLimited.mockReturnValue(false)
  mocks.requireCustomer.mockResolvedValue(token)
  db = new FakeDb()
  db.docs.set('users/user-1', { firstName: 'Dana', lastName: 'Levi', displayName: 'Dana Levi' })
  mocks.getDb.mockReturnValue(db)
  vi.spyOn(console, 'error').mockImplementation(() => {})
})
afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks() })

const valid = { confirm: true, reason: 'privacy', details: 'Please remove\neverything.', lang: 'he' }

function post(body: unknown, headers: Record<string, string> = {}) {
  return POST(new Request('https://landly.test/api/account/delete-request', {
    method: 'POST',
    headers: { Authorization: 'Bearer test-token', ...headers },
    body: JSON.stringify(body),
  }))
}

describe('/api/account/delete-request', () => {
  it('emails the team inbox with Reply-To set to the member and records the request', async () => {
    const res = await post(valid)
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true })
    expect(mocks.send).toHaveBeenCalledTimes(1)
    const mail = mocks.send.mock.calls[0][0]
    expect(mail.to).toBe('contact@golandly.com')
    expect(mail.replyTo).toBe('dana@example.com')
    expect(mail.subject).toBe('[Landly Account Deletion Request] Dana Levi (dana@example.com)')
    for (const part of ['user-1', 'Dana Levi', 'dana@example.com', 'Privacy concerns', 'google.com', 'he', 'Please remove']) expect(mail.html).toContain(part)
    expect(mail.text).toMatch(/Requested at: \d{4}-\d\d-\d\dT/)
    const record = db.docs.get('accountDeletionRequests/user-1')!
    expect(record).toMatchObject({ uid: 'user-1', email: 'dana@example.com', name: 'Dana Levi', reason: 'privacy', lang: 'he', status: 'pending' })
    expect(record.requestedAt).toBeInstanceOf(Date)
  })

  it('takes who is asking from the verified token, never the body', async () => {
    await post({ ...valid, email: 'attacker@evil.test', uid: 'someone-else', name: 'Mallory' })
    const mail = mocks.send.mock.calls[0][0]
    expect(mail.replyTo).toBe('dana@example.com')
    expect(mail.html).not.toContain('attacker@evil.test')
    expect(mail.html).not.toContain('someone-else')
    expect(mail.html).not.toContain('Mallory')
    expect(db.docs.has('accountDeletionRequests/someone-else')).toBe(false)
  })

  it('falls back to the token name when there is no profile', async () => {
    db.docs.delete('users/user-1')
    await post(valid)
    expect(mocks.send.mock.calls[0][0].subject).toBe('[Landly Account Deletion Request] Token Name (dana@example.com)')
  })

  it('requires sign-in before reading anything', async () => {
    mocks.requireCustomer.mockRejectedValue(new mocks.MockRequestAuthError('Unauthorized', 401))
    expect((await post(valid)).status).toBe(401)
    expect(mocks.getDb).not.toHaveBeenCalled()
    expect(mocks.send).not.toHaveBeenCalled()
  })

  it('refuses business accounts', async () => {
    mocks.requireCustomer.mockRejectedValue(new mocks.MockRequestAuthError('This account cannot access this resource.', 403))
    expect((await post(valid)).status).toBe(403)
    expect(mocks.send).not.toHaveBeenCalled()
  })

  it.each([
    ['no confirmation', { ...valid, confirm: undefined }],
    ['a truthy but non-true confirmation', { ...valid, confirm: 'yes' }],
    ['an unknown reason', { ...valid, reason: 'spite' }],
    ['over-long details', { ...valid, details: 'x'.repeat(DELETION_DETAILS_MAX + 1) }],
  ])('rejects %s', async (_, body) => {
    expect((await post(body)).status).toBe(400)
    expect(mocks.send).not.toHaveBeenCalled()
    expect(db.docs.has('accountDeletionRequests/user-1')).toBe(false)
  })

  it('rejects an account with no email', async () => {
    mocks.requireCustomer.mockResolvedValue({ ...token, email: undefined })
    expect((await post(valid)).status).toBe(400)
    expect(mocks.send).not.toHaveBeenCalled()
  })

  it('answers ok to a repeat within 24 hours without emailing again', async () => {
    expect((await post(valid)).status).toBe(200)
    const again = await post(valid)
    expect(again.status).toBe(200)
    expect(await again.json()).toEqual({ ok: true, duplicate: true })
    expect(mocks.send).toHaveBeenCalledTimes(1)
  })

  it('accepts a new request once 24 hours have passed', async () => {
    db.docs.set('accountDeletionRequests/user-1', { requestedAt: new Date(Date.now() - DELETION_DEDUPE_MS - 60_000), reason: null })
    expect((await post(valid)).status).toBe(200)
    expect(mocks.send).toHaveBeenCalledTimes(1)
    expect(db.docs.get('accountDeletionRequests/user-1')!.reason).toBe('privacy')
  })

  it('reads Firestore Timestamps for the 24-hour check', async () => {
    db.docs.set('accountDeletionRequests/user-1', { requestedAt: { toMillis: () => Date.now() - 1000 } })
    expect(await (await post(valid)).json()).toEqual({ ok: true, duplicate: true })
    expect(mocks.send).not.toHaveBeenCalled()
  })

  it('rolls the record back when the email fails, so a retry can send', async () => {
    mocks.send.mockResolvedValueOnce({ error: { name: 'application_error', statusCode: 500, message: 'down' } })
    expect((await post(valid)).status).toBe(502)
    expect(db.docs.has('accountDeletionRequests/user-1')).toBe(false)
    expect((await post(valid)).status).toBe(200)
    expect(mocks.send).toHaveBeenCalledTimes(2)
  })

  it('restores an older request on a failed send', async () => {
    const older = { requestedAt: new Date(Date.now() - 3 * DELETION_DEDUPE_MS), reason: 'moving' }
    db.docs.set('accountDeletionRequests/user-1', older)
    mocks.send.mockResolvedValueOnce({ error: { name: 'application_error', statusCode: 500, message: 'down' } })
    expect((await post(valid)).status).toBe(502)
    expect(db.docs.get('accountDeletionRequests/user-1')).toEqual(older)
  })

  it('reports 503 without emailing when the record cannot be written', async () => {
    db.failTransaction = true
    expect((await post(valid)).status).toBe(503)
    expect(mocks.send).not.toHaveBeenCalled()
  })

  it('gives honeypot submissions a fake success without checking anything', async () => {
    const res = await post({ ...valid, website: 'https://spam.example' })
    expect(res.status).toBe(200)
    expect(mocks.requireCustomer).not.toHaveBeenCalled()
    expect(mocks.send).not.toHaveBeenCalled()
  })

  it('rate-limits by IP before checking the token', async () => {
    mocks.ipLimited.mockReturnValue(true)
    expect((await post(valid)).status).toBe(429)
    expect(mocks.requireCustomer).not.toHaveBeenCalled()
  })

  it('rate-limits by account', async () => {
    mocks.uidLimited.mockReturnValue(true)
    expect((await post(valid)).status).toBe(429)
    expect(mocks.uidLimited).toHaveBeenCalledWith('user-1')
    expect(mocks.send).not.toHaveBeenCalled()
  })

  it('allows the Expo web build (loopback origin) through CORS, on the preflight and the response', async () => {
    const pre = OPTIONS(new Request('https://landly.test/api/account/delete-request', { method: 'OPTIONS', headers: { Origin: 'http://localhost:8081' } }))
    expect(pre.status).toBe(204)
    expect(pre.headers.get('access-control-allow-origin')).toBe('http://localhost:8081')
    expect(pre.headers.get('access-control-allow-headers')).toContain('Authorization')
    const res = await post(valid, { Origin: 'http://localhost:8081' })
    expect(res.headers.get('access-control-allow-origin')).toBe('http://localhost:8081')
    const other = await post(valid, { Origin: 'https://evil.example' })
    expect(other.headers.get('access-control-allow-origin')).toBeNull()
  })
})

describe('parseDeletionRequest', () => {
  it('treats the reason and details as optional', () => {
    expect(parseDeletionRequest({ confirm: true })).toEqual({ reason: null, details: '', lang: '' })
    expect(parseDeletionRequest({ confirm: true, reason: '', details: '' })).toEqual({ reason: null, details: '', lang: '' })
    expect(parseDeletionRequest({ confirm: true, reason: null })).toEqual({ reason: null, details: '', lang: '' })
  })

  it('accepts every listed reason', () => {
    for (const reason of DELETION_REASONS) expect(parseDeletionRequest({ confirm: true, reason })?.reason).toBe(reason)
  })

  it('cleans the details and the language', () => {
    expect(parseDeletionRequest({ confirm: true, details: '  a\r\n\n\n\nb\u0007  ', lang: 'he\nX-Injected: 1' })).toEqual({
      reason: null,
      details: 'a\n\nb',
      lang: 'he X-Inj',
    })
  })

  it('rejects non-objects and non-string details', () => {
    expect(parseDeletionRequest(null)).toBeNull()
    expect(parseDeletionRequest('confirm')).toBeNull()
    expect(parseDeletionRequest({ confirm: true, details: 42 })).toBeNull()
  })
})

describe('deletion email', () => {
  const base: DeletionRequestEmail = {
    uid: 'u1', name: 'Dana Levi', email: 'dana@example.com', providers: ['password'], requestedAt: new Date('2026-10-16T09:30:00Z'),
    reason: null, details: '', lang: 'en',
  }

  it('escapes HTML and keeps the subject on one line', () => {
    const mail = buildDeletionRequestEmail({ ...base, name: 'Dana\r\nBcc: x@y.z <b>Levi</b>', details: '<script>alert(1)</script>' })
    expect(mail.subject).toBe('[Landly Account Deletion Request] Dana Bcc: x@y.z <b>Levi</b> (dana@example.com)')
    expect(mail.subject).not.toMatch(/[\r\n]/)
    expect(mail.html).not.toContain('<script>')
    expect(mail.html).toContain('&lt;script&gt;')
  })

  it('says when no reason or details were given, and shows Israel time', () => {
    const mail = buildDeletionRequestEmail(base)
    expect(mail.text).toContain('Reason: Not given')
    expect(mail.text).toContain('(no details given)')
    expect(mail.text).toContain('2026-10-16T09:30:00.000Z (Israel: 16 Oct 2026, 12:30)')
  })
})

describe('deletion translations', () => {
  it('has every deletion and settings string in all five languages', () => {
    const keys = [
      ...Object.values(DELETION_REASON_KEYS),
      'del_row_title', 'del_row_sub', 'del_title', 'del_intro', 'del_email_label', 'del_reason_label', 'del_reason_placeholder',
      'del_details_label', 'del_confirm', 'del_submit', 'del_sending', 'del_cancel', 'del_success_title', 'del_success_body',
      'del_rate_limited', 'del_error', 'del_session_expired', 'del_done',
      'settings_back', 'settings_group_prefs', 'settings_group_account', 'settings_group_help', 'settings_group_danger',
      'settings_close',
    ] as const
    for (const lang of ['en', 'he', 'ru', 'es', 'fr'] as const) {
      for (const key of keys) expect(translations[lang][key], `${lang}.${key}`).toBeTruthy()
    }
    expect(translations.en.del_confirm).toBe('I understand that deleting my account will permanently remove my profile, perks, and active passes.')
    expect(translations.he.del_row_title).toBe('מחיקת חשבון')
  })
})

import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  send: vi.fn(),
  uid: vi.fn(),
  getUser: vi.fn(),
  user: null as Record<string, unknown> | null,
  update: vi.fn(),
  txFails: false,
  addSubscriber: vi.fn(),
  after: vi.fn(),
}))
// after() needs a request scope; here it records the callback and runs it at once.
vi.mock('next/server', async (importOriginal) => ({
  ...(await importOriginal<typeof import('next/server')>()),
  after: (task: () => unknown) => { mocks.after(task); void task() },
}))
vi.mock('@/lib/responder/addSubscriber', () => ({ addSubscriber: mocks.addSubscriber }))
vi.mock('resend', () => ({ Resend: class { emails = { send: mocks.send } } }))
vi.mock('@/lib/firebase/verifyRequestUser', () => ({
  requireVerifiedCustomerUid: mocks.uid,
  RequestAuthError: class extends Error {
    constructor(message: string, public readonly status: number) { super(message) }
  },
}))
// An in-memory users/{uid}: the transaction applies its update to the same
// object, so a second call sees the claim, as Firestore would.
vi.mock('@/lib/firebase/admin', () => {
  const ref = {
    update: async (patch: Record<string, unknown>) => {
      mocks.update(patch)
      for (const [k, v] of Object.entries(patch)) {
        if ((v as { _delete?: boolean })?._delete) delete mocks.user![k]
        else mocks.user![k] = v
      }
    },
  }
  return {
    getAdminAuth: () => ({ getUser: mocks.getUser }),
    getAdminDb: () => ({
      collection: () => ({ doc: () => ref }),
      runTransaction: async <T,>(fn: (tx: unknown) => Promise<T>) => {
        if (mocks.txFails) throw Object.assign(new Error('unavailable'), { code: 14 })
        return fn({
          get: async () => ({ data: () => (mocks.user ? { ...mocks.user } : undefined) }),
          update: (_ref: unknown, patch: Record<string, unknown>) => { Object.assign(mocks.user!, patch) },
        })
      },
    }),
  }
})
vi.mock('firebase-admin/firestore', () => ({
  FieldValue: { serverTimestamp: () => 'SERVER_TIME', delete: () => ({ _delete: true }) },
}))

import { buildWelcomeEmail } from '@/lib/email/sendWelcomeEmail'
import { renderBrandedEmail } from '@/lib/email/brandedEmail'
import { translations, type Lang } from '@/lib/i18n/translations'
import { OPTIONS, POST } from '@/app/api/account/welcome-email/route'
import { RequestAuthError } from '@/lib/firebase/verifyRequestUser'

const LANGS: Lang[] = ['en', 'he', 'fr', 'ru', 'es']
const ORIGIN = 'https://landly.test'
const at = (ms: number) => ({ toMillis: () => ms })

function call(headers: Record<string, string> = {}) {
  return POST(new Request('https://landly.test/api/account/welcome-email', {
    method: 'POST', headers: { authorization: 'Bearer token', ...headers }, body: '{}',
  }))
}

function render(lang: Lang, firstName = 'Dana') {
  const { subject: _subject, ...content } = buildWelcomeEmail(lang, firstName, ORIGIN)
  return renderBrandedEmail({ lang, origin: ORIGIN, ...content })
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubEnv('APP_URL', 'https://landly.test/')
  vi.stubEnv('EMAIL_FROM', 'Landly <noreply@golandly.com>')
  vi.stubEnv('RESEND_API_KEY', 'fake-test-key')
  mocks.txFails = false
  mocks.uid.mockResolvedValue('member-1')
  mocks.getUser.mockResolvedValue({ email: 'member@landly.test' })
  mocks.send.mockResolvedValue({ error: null })
  mocks.addSubscriber.mockResolvedValue('created')
  mocks.user = { firstName: 'Dana', preferredLanguage: 'en', onboardingCompletedAt: at(Date.now() - 1000) }
})

describe('welcome email content', () => {
  it('has every welcome string in all five languages', () => {
    const keys = Object.keys(translations.en).filter((k) => k.startsWith('welcomeEmail_'))
    expect(keys).toHaveLength(7)
    for (const lang of LANGS) {
      for (const key of keys) expect(translations[lang][key as keyof typeof translations.en], `${lang}.${key}`).toBeTruthy()
      expect(translations[lang].welcomeEmail_headingNamed).toContain('{firstName}')
    }
  })

  it('greets by first name, and falls back to the plain heading without one', () => {
    expect(buildWelcomeEmail('en', 'Dana', ORIGIN).heading).toBe('Welcome to Landly, Dana!')
    expect(buildWelcomeEmail('en', '  ', ORIGIN).heading).toBe('Welcome to Landly!')
    expect(buildWelcomeEmail('fr', '', ORIGIN).heading).toBe('Bienvenue sur Landly !')
    // A name is inserted literally, never read as a replace() pattern.
    expect(buildWelcomeEmail('en', '$&', ORIGIN).heading).toBe('Welcome to Landly, $&!')
  })

  it('points the button at the member area', () => {
    const html = render('en')
    expect(html.match(/href="https:\/\/landly\.test\/member"/g)!.length).toBeGreaterThanOrEqual(3)
  })

  it('uses the shared shell: logo, palette, footer and the help note instead of the security note', () => {
    const html = render('en')
    expect(html).toContain('width="48" height="46"')
    expect(html).toContain('background-color:#F8FAFC')
    expect(html).toContain('border:1px solid #E2E8F0;border-radius:16px')
    expect(html).toContain('fillcolor="#0066FF"')
    expect(html).toContain('mailto:contact@golandly.com')
    expect(html).toContain(translations.en.welcomeEmail_noteTitle)
    expect(html).toContain('This is an automated message.')
    expect(html).not.toContain('Security note')
    expect(html).not.toContain('&#128274;')
    expect(html).not.toMatch(/<script|<link|<style/i)
  })

  it('escapes the member name', () => {
    const html = render('en', '<b>Eve</b>')
    expect(html).toContain('&lt;b&gt;Eve&lt;/b&gt;')
    expect(html).not.toContain('<b>Eve</b>')
  })

  it('renders Hebrew right-to-left', () => {
    const html = render('he')
    expect(html).toContain('<html lang="he" dir="rtl"')
    expect(html).toContain('text-align:right')
    expect(html).toContain('border-right:3px solid #2563EB')
    expect(html).toContain('ברוכים הבאים ל-Landly, Dana!')
  })

  it('keeps every language in its own copy', () => {
    for (const lang of LANGS) expect(render(lang)).toContain(translations[lang].welcomeEmail_body)
  })
})

describe('welcome email route', () => {
  it('sends once in the member language, from the sender with replies to support', async () => {
    mocks.user!.preferredLanguage = 'he'
    const res = await call()
    expect(await res.json()).toEqual({ ok: true, sent: true })
    expect(mocks.send).toHaveBeenCalledTimes(1)
    const payload = mocks.send.mock.calls[0][0]
    expect(payload).toMatchObject({
      from: 'Landly <noreply@golandly.com>',
      to: 'member@landly.test',
      replyTo: 'contact@golandly.com',
      subject: translations.he.welcomeEmail_subject,
    })
    expect(payload.html).toContain('dir="rtl"')
    expect(mocks.user).toMatchObject({ welcomeEmailSent: true, welcomeEmailSentAt: 'SERVER_TIME' })
  })

  it('never sends twice, however often it is called', async () => {
    await call()
    const again = await call()
    expect(await again.json()).toEqual({ ok: true, sent: false, reason: 'alreadySent' })
    expect(mocks.send).toHaveBeenCalledTimes(1)
  })

  it('does not send before onboarding is finished', async () => {
    delete mocks.user!.onboardingCompletedAt
    expect(await (await call()).json()).toEqual({ ok: true, sent: false, reason: 'notOnboarded' })
    mocks.user = null
    expect(await (await call()).json()).toEqual({ ok: true, sent: false, reason: 'notOnboarded' })
    expect(mocks.send).not.toHaveBeenCalled()
  })

  it('does not welcome members who onboarded long ago', async () => {
    mocks.user!.onboardingCompletedAt = at(Date.now() - 2 * 24 * 60 * 60 * 1000)
    expect(await (await call()).json()).toEqual({ ok: true, sent: false, reason: 'stale' })
    expect(mocks.send).not.toHaveBeenCalled()
    expect(mocks.user!.welcomeEmailSent).toBeUndefined()
  })

  it('falls back to English for an unknown stored language', async () => {
    mocks.user!.preferredLanguage = 'xx'
    await call()
    expect(mocks.send.mock.calls[0][0].subject).toBe(translations.en.welcomeEmail_subject)
  })

  it('refuses an unauthenticated or unverified caller without sending', async () => {
    mocks.uid.mockRejectedValueOnce(new RequestAuthError('Unauthorized', 401))
    expect((await call()).status).toBe(401)
    mocks.uid.mockRejectedValueOnce(new RequestAuthError('Verify your email before continuing.', 403))
    expect((await call()).status).toBe(403)
    expect(mocks.send).not.toHaveBeenCalled()
  })

  it('logs a Resend failure without the address and releases the claim', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    mocks.send.mockResolvedValueOnce({ error: { name: 'rate_limit_exceeded', statusCode: 429, message: 'Too many requests' } })
    const res = await call()
    expect(res.status).toBe(502)
    expect(mocks.user!.welcomeEmailSent).toBeUndefined()
    const line = error.mock.calls.map((c) => c.join(' ')).join('\n')
    expect(line).toContain('step=resend')
    expect(line).toContain('rate_limit_exceeded')
    expect(line).not.toContain('member@landly.test')
    error.mockRestore()
  })

  it('answers 503 when Firestore is unavailable, without sending', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    mocks.txFails = true
    expect((await call()).status).toBe(503)
    expect(mocks.send).not.toHaveBeenCalled()
    error.mockRestore()
  })

  it('reports missing email settings before touching Firestore', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.stubEnv('RESEND_API_KEY', '')
    expect((await call()).status).toBe(502)
    expect(mocks.user!.welcomeEmailSent).toBeUndefined()
    expect(error.mock.calls[0][0]).toContain('step=config')
    error.mockRestore()
  })

  it('adds a member who opted into marketing to Responder, once, with the verified address', async () => {
    mocks.user!.marketingOptIn = true
    await call()
    await call()
    expect(mocks.after).toHaveBeenCalledTimes(1)
    expect(mocks.addSubscriber).toHaveBeenCalledTimes(1)
    expect(mocks.addSubscriber).toHaveBeenCalledWith({ uid: 'member-1', email: 'member@landly.test', firstName: 'Dana' })
  })

  it('never adds a member who did not opt in', async () => {
    await call()
    mocks.user = { firstName: 'Dana', preferredLanguage: 'en', onboardingCompletedAt: at(Date.now() - 1000), marketingOptIn: 'yes' }
    await call()
    expect(mocks.send).toHaveBeenCalledTimes(2)
    expect(mocks.after).not.toHaveBeenCalled()
    expect(mocks.addSubscriber).not.toHaveBeenCalled()
  })

  it('does not wait on Responder: a hung sync still sends the welcome', async () => {
    mocks.user!.marketingOptIn = true
    mocks.addSubscriber.mockReturnValueOnce(new Promise(() => {}))
    expect(await (await call()).json()).toEqual({ ok: true, sent: true })
    expect(mocks.send).toHaveBeenCalledTimes(1)
  })

  it('does not sync when the welcome is skipped', async () => {
    mocks.user!.marketingOptIn = true
    mocks.user!.onboardingCompletedAt = at(Date.now() - 2 * 24 * 60 * 60 * 1000)
    await call()
    expect(mocks.addSubscriber).not.toHaveBeenCalled()
  })

  it('answers the Expo web preflight from a loopback origin', async () => {
    const res = OPTIONS(new Request('https://landly.test/api/account/welcome-email', { method: 'OPTIONS', headers: { origin: 'http://localhost:8081' } }))
    expect(res.status).toBe(204)
    expect(res.headers.get('access-control-allow-origin')).toBe('http://localhost:8081')
  })
})

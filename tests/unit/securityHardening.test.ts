import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Timestamp } from 'firebase-admin/firestore'
import { MemoryFirestore } from '../helpers/memoryFirestore'

const mocks = vi.hoisted(() => ({
  store: null as unknown as MemoryFirestore,
  getUser: vi.fn(),
  getUserByEmail: vi.fn(),
  requireCustomer: vi.fn(),
}))
vi.mock('@/lib/firebase/admin', () => ({
  getAdminDb: () => mocks.store.db,
  getAdminAuth: () => ({ getUser: mocks.getUser, getUserByEmail: mocks.getUserByEmail }),
}))
vi.mock('@/lib/firebase/verifyRequestUser', () => ({
  requireCustomer: mocks.requireCustomer,
  RequestAuthError: class extends Error {
    constructor(message: string, public readonly status: number) { super(message) }
  },
}))

const UID = 'member-1'
const CUTOFF = 'Fri, 23 Oct 2026 10:00:05 GMT'
const stamp = () => (mocks.store.read(`users/${UID}`)?.sessionsValidAfter as Timestamp | undefined)?.toMillis()
const ipRequest = (ip: string) => new Request('https://test.invalid', { method: 'POST', headers: { 'x-vercel-forwarded-for': ip } })

beforeEach(() => {
  vi.resetModules()
  vi.clearAllMocks()
  vi.stubEnv('VERCEL', '1')
  vi.stubEnv('ADMIN_PASSWORD', 'correct horse battery staple')
  mocks.store = new MemoryFirestore()
  mocks.store.seed(`users/${UID}`, { email: 'a@landly.test' })
  mocks.getUser.mockResolvedValue({ tokensValidAfterTime: CUTOFF })
  mocks.getUserByEmail.mockResolvedValue({ uid: UID })
  mocks.requireCustomer.mockResolvedValue({ uid: UID })
})
afterEach(() => {
  vi.unstubAllEnvs()
  vi.useRealTimers()
})

describe('admin login throttle (Firestore)', () => {
  it('survives a cold start: a fresh process still sees the spent budget', async () => {
    let { checkAdminPasswordWithRateLimit } = await import('@/lib/admin/adminAuth')
    for (let i = 0; i < 10; i++) expect((await checkAdminPasswordWithRateLimit(ipRequest('192.0.2.1'), 'wrong'))?.status).toBe(401)
    vi.resetModules()
    ;({ checkAdminPasswordWithRateLimit } = await import('@/lib/admin/adminAuth'))
    expect((await checkAdminPasswordWithRateLimit(ipRequest('192.0.2.1'), 'correct horse battery staple'))?.status).toBe(429)
    // Another address keeps its own budget.
    expect(await checkAdminPasswordWithRateLimit(ipRequest('192.0.2.2'), 'correct horse battery staple')).toBeNull()
  })

  it('caps guesses across all addresses, so many IPs get no more than 50 tries in total', async () => {
    const { checkAdminPasswordWithRateLimit } = await import('@/lib/admin/adminAuth')
    for (let i = 0; i < 50; i++) expect((await checkAdminPasswordWithRateLimit(ipRequest(`198.51.100.${i}`), 'wrong'))?.status).toBe(401)
    expect((await checkAdminPasswordWithRateLimit(ipRequest('203.0.113.9'), 'wrong'))?.status).toBe(429)
  })

  it('a correct password clears its address and gives its slot back, and the window expires', async () => {
    const { checkAdminPasswordWithRateLimit } = await import('@/lib/admin/adminAuth')
    for (let i = 0; i < 9; i++) await checkAdminPasswordWithRateLimit(ipRequest('192.0.2.1'), 'wrong')
    expect(await checkAdminPasswordWithRateLimit(ipRequest('192.0.2.1'), 'correct horse battery staple')).toBeNull()
    expect(mocks.store.read('adminLoginThrottle/global')?.count).toBe(9)
    for (let i = 0; i < 10; i++) expect((await checkAdminPasswordWithRateLimit(ipRequest('192.0.2.1'), 'wrong'))?.status).toBe(401)
    expect((await checkAdminPasswordWithRateLimit(ipRequest('192.0.2.1'), 'wrong'))?.status).toBe(429)
    vi.useFakeTimers({ now: Date.now() + 15 * 60 * 1000 + 1, toFake: ['Date'] })
    expect((await checkAdminPasswordWithRateLimit(ipRequest('192.0.2.1'), 'wrong'))?.status).toBe(401)
  })

  it('never stores the raw address, and refuses logins when the throttle is unreachable', async () => {
    const { checkAdminPasswordWithRateLimit } = await import('@/lib/admin/adminAuth')
    await checkAdminPasswordWithRateLimit(ipRequest('192.0.2.77'), 'wrong')
    expect(JSON.stringify([...mocks.store['records'].entries()])).not.toContain('192.0.2.77')
    vi.spyOn(console, 'error').mockImplementation(() => {})
    mocks.store.db.runTransaction = () => Promise.reject(Object.assign(new Error('down'), { code: 14 }))
    expect((await checkAdminPasswordWithRateLimit(ipRequest('192.0.2.1'), 'correct horse battery staple'))?.status).toBe(503)
  })
})

describe('session cutoff after password changes', () => {
  it('syncSessionCutoff copies Auth\'s cutoff and never moves it back', async () => {
    const { syncSessionCutoff } = await import('@/lib/auth/sessionRevocation')
    await syncSessionCutoff(UID)
    expect(stamp()).toBe(Date.parse(CUTOFF))
    mocks.getUser.mockResolvedValue({ tokensValidAfterTime: 'Thu, 01 Jan 2026 00:00:00 GMT' })
    await syncSessionCutoff(UID)
    expect(stamp()).toBe(Date.parse(CUTOFF))
    // Nothing ever revoked: nothing written.
    mocks.store.seed('users/never', { email: 'n@landly.test' })
    mocks.getUser.mockResolvedValue({})
    await syncSessionCutoff('never')
    expect(mocks.store.read('users/never')).not.toHaveProperty('sessionsValidAfter')
  })

  it('/api/account/sync-sessions stamps the caller only, from the verified token', async () => {
    const { POST } = await import('@/app/api/account/sync-sessions/route')
    const res = await POST(new Request('https://test.invalid', { method: 'POST', body: JSON.stringify({ uid: 'someone-else' }) }))
    expect(res.status).toBe(200)
    expect(mocks.getUser).toHaveBeenCalledWith(UID)
    expect(stamp()).toBe(Date.parse(CUTOFF))
  })

  it('/api/auth/password-reset-complete mirrors the reset for the address, answering the same either way', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'performance'] })
    const { POST } = await import('@/app/api/auth/password-reset-complete/route')
    const call = async (email: string) => {
      const pending = POST(new Request('https://test.invalid', { method: 'POST', body: JSON.stringify({ email }) }))
      await vi.advanceTimersByTimeAsync(1000)
      return pending
    }
    const known = await call('a@landly.test')
    expect(await known.json()).toEqual({ ok: true })
    expect(stamp()).toBe(Date.parse(CUTOFF))

    mocks.getUserByEmail.mockRejectedValue(Object.assign(new Error('none'), { code: 'auth/user-not-found' }))
    const unknown = await call('nobody@landly.test')
    expect(unknown.status).toBe(known.status)
    expect(await unknown.json()).toEqual({ ok: true })
  })

  it('/api/auth/password-reset-complete leaves business logins alone', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'performance'] })
    mocks.store.seed(`businesses/${UID}`, { businessName: 'Café' })
    const { POST } = await import('@/app/api/auth/password-reset-complete/route')
    const pending = POST(new Request('https://test.invalid', { method: 'POST', body: JSON.stringify({ email: 'a@landly.test' }) }))
    await vi.advanceTimersByTimeAsync(1000)
    expect((await pending).status).toBe(200)
    expect(stamp()).toBeUndefined()
  })
})

describe('password screens report the change (lib/account/sessionSync.ts)', () => {
  it('posts the session token after a change, and the address after a reset, through the app base URL', async () => {
    const fetch = vi.fn().mockResolvedValue(new Response('{"ok":true}', { status: 200 }))
    vi.stubGlobal('fetch', fetch)
    const { reportPasswordReset, syncSessionsAfterPasswordChange } = await import('@/lib/account/sessionSync')
    expect(await syncSessionsAfterPasswordChange('tok', 'https://api.landly.test/')).toBe(true)
    expect(fetch.mock.calls[0][0]).toBe('https://api.landly.test/api/account/sync-sessions')
    expect(fetch.mock.calls[0][1]).toMatchObject({ method: 'POST', headers: { Authorization: 'Bearer tok' }, redirect: 'manual' })
    expect(await reportPasswordReset('a@landly.test')).toBe(true)
    expect(fetch.mock.calls[1][0]).toBe('/api/auth/password-reset-complete')
    expect(JSON.parse(fetch.mock.calls[1][1].body)).toEqual({ email: 'a@landly.test' })
    fetch.mockRejectedValue(new TypeError('offline'))
    expect(await reportPasswordReset('a@landly.test')).toBe(false)
    vi.unstubAllGlobals()
  })

  it('is called right after every password change and reset, web and app', async () => {
    const { readFileSync } = await import('node:fs')
    const read = (p: string) => readFileSync(p, 'utf8')
    expect(read('app/reset-password/page.tsx')).toMatch(/await confirmPasswordReset\(auth, oobCode, password\)[\s\S]{0,200}await reportPasswordReset\(email\)/)
    expect(read('components/settings/SecuritySection.tsx')).toMatch(/await updatePassword\(user, newPassword\)[\s\S]{0,200}syncSessionsAfterPasswordChange\(idToken\)/)
    expect(read('landly-mobile/src/components/ChangePassword.tsx')).toMatch(/await updatePassword\(user, next\)[\s\S]{0,200}syncSessionsAfterPasswordChange\(idToken, API_BASE_URL\)/)
  })
})

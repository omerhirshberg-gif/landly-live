import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  reset: vi.fn(), verification: vi.fn(), send: vi.fn(), getUser: vi.fn(), token: vi.fn(), createDoc: vi.fn(), docPath: vi.fn(), ipLimited: vi.fn(() => false),
}))
vi.mock('resend', () => ({ Resend: class { emails = { send: mocks.send } } }))
vi.mock('@/lib/firebase/admin', () => ({
  getAdminAuth: () => ({ generatePasswordResetLink: mocks.reset, generateEmailVerificationLink: mocks.verification, getUser: mocks.getUser }),
  getAdminDb: () => ({
    collection: (name: string) => ({
      doc: (id: string) => {
        mocks.docPath(`${name}/${id}`)
        return { get: async () => ({ exists: false }), create: mocks.createDoc }
      },
    }),
  }),
}))
vi.mock('@/lib/firebase/verifyRequestUser', () => ({
  requireCustomer: mocks.token,
  RequestAuthError: class extends Error {
    constructor(message: string, public readonly status: number) { super(message) }
  },
}))
vi.mock('@/lib/auth/passwordResetRateLimit', () => ({ isPasswordResetRateLimited: () => false }))
vi.mock('@/lib/auth/verificationRateLimit', () => ({ isVerificationIpRateLimited: mocks.ipLimited, isVerificationUidRateLimited: () => false }))

import { applicationOrigin } from '@/lib/auth/requestContext'
import { sendBrandedEmail } from '@/lib/email/brandedEmail'
import { POST as reset } from '@/app/api/auth/forgot-password/route'
import { OPTIONS as verifyPreflight, POST as verify } from '@/app/api/auth/send-verification/route'
import { RequestAuthError } from '@/lib/firebase/verifyRequestUser'

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubEnv('APP_URL', 'https://landly.test/')
  vi.stubEnv('EMAIL_FROM', 'test@landly.test')
  vi.stubEnv('RESEND_API_KEY', 'fake-test-key')
  mocks.reset.mockResolvedValue('https://firebase.test/action?oobCode=reset&mode=resetPassword')
  mocks.verification.mockResolvedValue('https://firebase.test/action?oobCode=verify&mode=verifyEmail')
  mocks.send.mockResolvedValue({ error: null })
  mocks.getUser.mockResolvedValue({ emailVerified: false, email: 'person@landly.test' })
  mocks.token.mockResolvedValue({ uid: 'user', firebase: { sign_in_provider: 'password' } })
  mocks.createDoc.mockResolvedValue(undefined)
  mocks.ipLimited.mockReturnValue(false)
  vi.spyOn(console, 'error').mockImplementation(() => {})
})
afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks() })

function request() {
  return new Request('https://attacker.invalid', {
    method: 'POST', headers: { host: 'attacker.invalid', 'x-forwarded-proto': 'http', 'x-forwarded-host': 'attacker.invalid' },
    body: JSON.stringify({ email: 'person@landly.test', lang: 'en' }),
  })
}

describe('configured origin', () => {
  it('ignores all host headers in both email flows', async () => {
    expect((await reset(request())).status).toBe(200)
    expect(mocks.reset).toHaveBeenCalledWith('person@landly.test', { url: 'https://landly.test/reset-password/success', handleCodeInApp: true })
    expect((await verify(request())).status).toBe(200)
    const emails = mocks.send.mock.calls.map(([email]) => email.html)
    expect(emails).toHaveLength(2)
    for (const email of emails) {
      expect(email).not.toContain('attacker.invalid')
      expect(email).toContain('https://landly.test/logo.jpg')
    }
    expect(emails[1]).toContain('href="https://landly.test/verify-email?oobCode=verify"')
  })
  it.each(['', 'not a URL', 'http://landly.test', 'javascript:alert(1)', 'https://user:pass@landly.test', 'https://landly.test/path', 'https://landly.test/?q=x', 'https://landly.test/#fragment'])('rejects invalid APP_URL %j without sending either email', async (origin) => {
    vi.stubEnv('APP_URL', origin)
    expect(() => applicationOrigin()).toThrow()
    expect(await (await reset(request())).json()).toEqual({ ok: true })
    expect((await verify(request())).status).toBe(502)
    expect(mocks.send).not.toHaveBeenCalled()
    expect(mocks.reset).not.toHaveBeenCalled()
    expect(mocks.verification).not.toHaveBeenCalled()
  })
  it('allows HTTP loopback only in development', () => {
    vi.stubEnv('APP_URL', 'http://localhost:3000/')
    vi.stubEnv('NODE_ENV', 'production')
    expect(() => applicationOrigin()).toThrow()
    vi.stubEnv('NODE_ENV', 'development')
    expect(applicationOrigin()).toBe('http://localhost:3000')
  })
  it('normalizes the trailing slash', () => { expect(applicationOrigin()).toBe('https://landly.test') })
  it('escapes the full href and src, including quotes, ampersands and angle brackets', async () => {
    await sendBrandedEmail({
      to: 'person@landly.test', lang: 'en', origin: 'https://test.invalid/"<>&\'',
      subject: 'Test', heading: 'Heading', body: 'Body', buttonLabel: 'Go',
      buttonLink: 'https://test.invalid/?a=1&b="<tag>\'', footnote: 'Footnote',
    })
    const html = mocks.send.mock.calls[0][0].html
    expect(html).toContain('src="https://test.invalid/&quot;&lt;&gt;&amp;&#39;/logo.jpg"')
    expect(html).toContain('href="https://test.invalid/?a=1&amp;b=&quot;&lt;tag&gt;&#39;"')
  })
})

describe('verification email: customer profile', () => {
  it('creates the users doc in the requested language alongside the email', async () => {
    const req = new Request('https://landly.test/api/auth/send-verification', { method: 'POST', body: JSON.stringify({ lang: 'he' }) })
    expect((await verify(req)).status).toBe(200)
    expect(mocks.docPath).toHaveBeenCalledWith('users/user')
    expect(mocks.createDoc).toHaveBeenCalledWith(expect.objectContaining({ email: 'person@landly.test', preferredLanguage: 'he', phone: '', customerType: '' }))
    expect(mocks.send).toHaveBeenCalledTimes(1)
  })

  it('leaves an existing doc alone and still sends the email', async () => {
    mocks.createDoc.mockRejectedValue(Object.assign(new Error('exists'), { code: 6 }))
    expect((await verify(request())).status).toBe(200)
    expect(mocks.send).toHaveBeenCalledTimes(1)
    expect(console.error).not.toHaveBeenCalled()
  })

  it('still sends the email when Firestore is unavailable', async () => {
    mocks.createDoc.mockRejectedValue(Object.assign(new Error('unavailable'), { code: 14 }))
    expect((await verify(request())).status).toBe(200)
    expect(mocks.send).toHaveBeenCalledTimes(1)
  })
})

describe('verification email: CORS', () => {
  const withOrigin = (origin: string, method = 'POST') =>
    new Request('https://www.landly.test/api/auth/send-verification', { method, headers: { origin }, body: method === 'POST' ? '{}' : undefined })

  it('answers the Expo web preflight from a loopback origin', async () => {
    const res = verifyPreflight(withOrigin('http://localhost:8081', 'OPTIONS'))
    expect(res.status).toBe(204)
    expect(res.headers.get('access-control-allow-origin')).toBe('http://localhost:8081')
    expect(res.headers.get('access-control-allow-headers')).toMatch(/authorization/i)
  })

  it('allows configured origins and nothing else', async () => {
    vi.stubEnv('CORS_ALLOWED_ORIGINS', 'https://app.landly.test, https://other.landly.test/')
    expect((await verify(withOrigin('https://other.landly.test'))).headers.get('access-control-allow-origin')).toBe('https://other.landly.test')
    expect(verifyPreflight(withOrigin('https://evil.test', 'OPTIONS')).headers.get('access-control-allow-origin')).toBeNull()
    expect((await verify(withOrigin('https://evil.test'))).headers.get('access-control-allow-origin')).toBeNull()
  })

  it('adds the headers to error responses too, so the browser can read them', async () => {
    mocks.token.mockRejectedValue(new RequestAuthError('Unauthorized', 401))
    const res = await verify(withOrigin('http://127.0.0.1:19006'))
    expect(res.status).toBe(401)
    expect(res.headers.get('access-control-allow-origin')).toBe('http://127.0.0.1:19006')
  })
})

describe('verification email: failure logging', () => {
  const logged = () => (console.error as unknown as { mock: { calls: unknown[][] } }).mock.calls.map((c) => c.join(' '))

  it('names a missing token, and whether the header arrived at all', async () => {
    mocks.token.mockRejectedValue(new RequestAuthError('Unauthorized', 401))
    const res = await verify(request())
    expect(res.status).toBe(401)
    expect(await res.json()).toMatchObject({ reason: 'unauthorized' })
    expect(logged()[0]).toContain('step=token')
    expect(logged()[0]).toContain('"hasAuthorization":false')
  })

  it("logs Resend's own error code and status, without the recipient", async () => {
    mocks.send.mockResolvedValue({ error: { name: 'validation_error', statusCode: 403, message: 'The golandly.com domain is not verified' } })
    const res = await verify(request())
    expect(res.status).toBe(502)
    expect(await res.json()).toMatchObject({ reason: 'provider' })
    const line = logged().find((l) => l.includes('step=resend'))!
    expect(line).toContain('"code":"validation_error"')
    expect(line).toContain('"status":403')
    expect(line).toContain('domain is not verified')
    expect(line).not.toContain('person@landly.test')
  })

  it('reports missing email settings as a config failure before calling Firebase', async () => {
    vi.stubEnv('RESEND_API_KEY', '')
    const res = await verify(request())
    expect(await res.json()).toMatchObject({ reason: 'config' })
    expect(logged().some((l) => l.includes('step=config') && l.includes('RESEND_API_KEY'))).toBe(true)
    expect(mocks.verification).not.toHaveBeenCalled()
  })

  it('logs a failed link generation with the Firebase code', async () => {
    mocks.verification.mockRejectedValue(Object.assign(new Error('quota'), { code: 'auth/quota-exceeded' }))
    const res = await verify(request())
    expect(await res.json()).toMatchObject({ reason: 'link' })
    expect(logged().some((l) => l.includes('step=link') && l.includes('auth/quota-exceeded'))).toBe(true)
  })

  it('turns an Auth outage while reading the user into a 503', async () => {
    mocks.getUser.mockRejectedValue(Object.assign(new Error('down'), { code: 'app/network-error' }))
    const res = await verify(request())
    expect(res.status).toBe(503)
    expect(logged().some((l) => l.includes('step=user'))).toBe(true)
  })
})

describe('verification email: rate-limit order', () => {
  it('does not count rejected or token-less requests against the IP', async () => {
    mocks.token.mockRejectedValue(new RequestAuthError('Unauthorized', 401))
    expect((await verify(request())).status).toBe(401)
    mocks.token.mockRejectedValue(new RequestAuthError('This account cannot access this resource.', 403))
    expect((await verify(request())).status).toBe(403)
    expect(mocks.ipLimited).not.toHaveBeenCalled()
  })

  it('counts an authenticated request, and refuses it once the IP is over the limit', async () => {
    mocks.ipLimited.mockReturnValue(true)
    const res = await verify(request())
    expect(mocks.ipLimited).toHaveBeenCalledTimes(1)
    expect(res.status).toBe(429)
    expect(await res.json()).toMatchObject({ reason: 'rateLimited' })
    expect(mocks.send).not.toHaveBeenCalled()
  })
})

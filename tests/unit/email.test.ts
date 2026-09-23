import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  reset: vi.fn(), verification: vi.fn(), send: vi.fn(), getUser: vi.fn(), token: vi.fn(),
}))
vi.mock('resend', () => ({ Resend: class { emails = { send: mocks.send } } }))
vi.mock('@/lib/firebase/admin', () => ({
  getAdminAuth: () => ({ generatePasswordResetLink: mocks.reset, generateEmailVerificationLink: mocks.verification, getUser: mocks.getUser }),
  getAdminDb: () => ({ collection: () => ({ doc: () => ({ get: async () => ({ exists: false }) }) }) }),
}))
vi.mock('@/lib/firebase/verifyRequestUser', () => ({ requireCustomer: mocks.token }))
vi.mock('@/lib/auth/passwordResetRateLimit', () => ({ isPasswordResetRateLimited: () => false }))
vi.mock('@/lib/auth/verificationRateLimit', () => ({ isVerificationIpRateLimited: () => false, isVerificationUidRateLimited: () => false }))

import { applicationOrigin } from '@/lib/auth/requestContext'
import { sendBrandedEmail } from '@/lib/email/brandedEmail'
import { POST as reset } from '@/app/api/auth/forgot-password/route'
import { POST as verify } from '@/app/api/auth/send-verification/route'

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

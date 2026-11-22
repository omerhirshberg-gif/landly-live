import { readFileSync } from 'node:fs'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Timestamp } from 'firebase-admin/firestore'
import { MemoryFirestore } from '../helpers/memoryFirestore'

const mocks = vi.hoisted(() => ({
  store: null as unknown as MemoryFirestore,
  token: vi.fn(),
  getUser: vi.fn(),
  updateUser: vi.fn(),
  createCustomToken: vi.fn(),
  send: vi.fn(),
  ipLimited: vi.fn(),
  uidLimited: vi.fn(),
}))
vi.mock('resend', () => ({ Resend: class { emails = { send: mocks.send } } }))
vi.mock('@/lib/firebase/admin', () => ({
  getAdminDb: () => mocks.store.db,
  getAdminAuth: () => ({ getUser: mocks.getUser, updateUser: mocks.updateUser, createCustomToken: mocks.createCustomToken }),
}))
vi.mock('@/lib/firebase/verifyRequestUser', () => ({
  requireCustomer: mocks.token,
  RequestAuthError: class extends Error {
    constructor(message: string, public readonly status: number) { super(message) }
  },
}))
vi.mock('@/lib/auth/uidRateLimit', () => ({ checkUidRateLimit: () => null }))
vi.mock('@/lib/auth/verificationRateLimit', () => ({
  isVerificationIpRateLimited: mocks.ipLimited,
  isVerificationUidRateLimited: mocks.uidLimited,
}))

import { POST as sendSignupOtp } from '@/app/api/auth/send-signup-otp/route'
import { POST as verifySignupOtp } from '@/app/api/auth/verify-signup-otp/route'
import { POST as changeEmail } from '@/app/api/account/change-email/route'
import { contactChangeErrorKey, requestSignupOtp, signupOtpStatus, verifySignupCode } from '@/lib/account/contactChange'
import { OTP_MAX_ATTEMPTS, OTP_TTL_MS, hashOtp, otpMatches } from '@/lib/auth/phoneVerification'
import { buildSignupCodeEmail } from '@/lib/email/sendSignupCodeEmail'
import { renderBrandedEmail } from '@/lib/email/brandedEmail'
import { translations, type Lang } from '@/lib/i18n/translations'

const UID = 'new-member'
const EMAIL = 'new.member@example.com'
const DOC = `signupEmailVerifications/${UID}`
const LANGS = Object.keys(translations) as Lang[]

const post = (body: unknown) =>
  new Request('https://landly.test/api', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer token' },
    body: JSON.stringify(body),
  })

let info: ReturnType<typeof vi.spyOn>
const loggedCode = () => String(info.mock.calls.map((c: unknown[]) => String(c[0])).findLast((l: string) => l.startsWith('[signup-otp] code ')) ?? '').slice(-6)
const emailedCode = () => String(mocks.send.mock.calls.at(-1)?.[0]?.html ?? '').match(/letter-spacing:10px[^>]*>(\d{6})</)?.[1] ?? ''
const send = (body: object = { lang: 'he' }) => sendSignupOtp(post(body))
const verify = (code: unknown) => verifySignupOtp(post({ code }))

beforeEach(() => {
  vi.clearAllMocks()
  mocks.store = new MemoryFirestore()
  mocks.token.mockResolvedValue({ uid: UID, firebase: { sign_in_provider: 'password' } })
  mocks.getUser.mockResolvedValue({ uid: UID, email: EMAIL, emailVerified: false, displayName: '', providerData: [{ providerId: 'password' }] })
  mocks.updateUser.mockResolvedValue({})
  mocks.createCustomToken.mockResolvedValue('custom-token')
  mocks.send.mockResolvedValue({ error: null })
  mocks.ipLimited.mockResolvedValue(false)
  mocks.uidLimited.mockResolvedValue(false)
  vi.stubEnv('APP_URL', 'https://landly.test/')
  vi.stubEnv('EMAIL_FROM', 'test@landly.test')
  vi.stubEnv('RESEND_API_KEY', 'fake-test-key')
  info = vi.spyOn(console, 'info').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})
})
afterEach(() => {
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})

describe('/api/auth/send-signup-otp', () => {
  it('emails a 6-digit code to the token’s own address, in the account language, replying to the team inbox', async () => {
    const res = await send({ lang: 'fr', firstName: 'Dana', lastName: 'Levi', agreedToTerms: true })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true, resendIn: 60 })
    const mail = mocks.send.mock.calls[0][0]
    expect(mail.to).toBe(EMAIL)
    expect(mail.replyTo).toMatch(/@/)
    expect(mail.subject).toBe(translations.fr.signupOtp_subject)
    expect(emailedCode()).toMatch(/^\d{6}$/)
  })

  it('stores only the salted hash, a 10-minute expiry and no attempts used', async () => {
    await send()
    const stored = mocks.store.read(DOC)!
    const code = emailedCode()
    expect(JSON.stringify(stored)).not.toContain(code)
    expect(otpMatches(UID, code, stored.codeHash)).toBe(true)
    expect(stored.attempts).toBe(0)
    expect(stored.expiresAt.toMillis() - stored.lastSentAt.toMillis()).toBeGreaterThan(OTP_TTL_MS - 2000)
    expect(stored.expiresAt.toMillis() - stored.lastSentAt.toMillis()).toBeLessThanOrEqual(OTP_TTL_MS)
  })

  it('prints the code, never the address or a token, to the development terminal', async () => {
    await send({ lang: 'en' })
    expect(loggedCode()).toBe(emailedCode())
    const everything = JSON.stringify([...info.mock.calls, ...vi.mocked(console.error).mock.calls])
    expect(everything).not.toContain(EMAIL)
    expect(everything).not.toContain('Bearer')
  })

  it('works without Resend in development, and refuses in production', async () => {
    vi.stubEnv('RESEND_API_KEY', '')
    const dev = await send()
    expect(dev.status).toBe(200)
    expect(loggedCode()).toMatch(/^\d{6}$/)
    expect(mocks.send).not.toHaveBeenCalled()

    mocks.store = new MemoryFirestore()
    vi.stubEnv('NODE_ENV', 'production')
    const prod = await send()
    expect(prod.status).toBe(502)
    expect(mocks.store.read(DOC)).toBeUndefined()
  })

  it('creates the profile from the sign-up names on the first request, and never overwrites it', async () => {
    await send({ lang: 'he', firstName: 'Dana', lastName: 'Levi', agreedToTerms: true, marketingOptIn: true })
    expect(mocks.store.read(`users/${UID}`)).toMatchObject({ email: EMAIL, firstName: 'Dana', lastName: 'Levi', agreedToTerms: true, marketingOptIn: true })
    mocks.store.seed(DOC, { ...mocks.store.read(DOC)!, lastSentAt: Timestamp.fromMillis(Date.now() - 61_000) })
    await send({ lang: 'he' })
    expect(mocks.store.read(`users/${UID}`)?.firstName).toBe('Dana')
  })

  it('allows one code a minute and reports the wait; the old code is replaced by the new one', async () => {
    await send()
    const first = emailedCode()
    const again = await send()
    expect(again.status).toBe(429)
    const body = await again.json()
    expect(body.reason).toBe('rateLimited')
    expect(body.retryAfter).toBeGreaterThan(50)
    expect(body.retryAfter).toBeLessThanOrEqual(60)
    expect(mocks.send).toHaveBeenCalledTimes(1)

    mocks.store.seed(DOC, { ...mocks.store.read(DOC)!, attempts: 3, lastSentAt: Timestamp.fromMillis(Date.now() - 61_000) })
    expect((await send()).status).toBe(200)
    expect(mocks.store.read(DOC)?.attempts).toBe(0)
    if (emailedCode() !== first) expect(otpMatches(UID, first, mocks.store.read(DOC)!.codeHash)).toBe(false)
  })

  it('reports the cooldown without sending anything for { status: true }', async () => {
    expect(await (await send({ status: true })).json()).toEqual({ ok: true, resendIn: 0 })
    await send()
    const status = await (await send({ status: true })).json()
    expect(status.ok).toBe(true)
    expect(status.resendIn).toBeGreaterThan(50)
    expect(mocks.send).toHaveBeenCalledTimes(1)
  })

  it('applies the IP and per-account limits, and skips verified and federated accounts', async () => {
    mocks.ipLimited.mockResolvedValue(true)
    expect((await send()).status).toBe(429)
    mocks.ipLimited.mockResolvedValue(false)
    mocks.uidLimited.mockResolvedValue(true)
    expect((await send()).status).toBe(429)
    expect(mocks.send).not.toHaveBeenCalled()

    mocks.uidLimited.mockResolvedValue(false)
    mocks.getUser.mockResolvedValue({ uid: UID, email: EMAIL, emailVerified: true, providerData: [] })
    expect(await (await send()).json()).toEqual({ ok: true, resendIn: 0 })
    mocks.token.mockResolvedValue({ uid: UID, firebase: { sign_in_provider: 'google.com' } })
    expect(await (await send()).json()).toEqual({ ok: true, resendIn: 0 })
    expect(mocks.send).not.toHaveBeenCalled()
  })

  it('frees the cooldown when the email could not be delivered', async () => {
    mocks.send.mockResolvedValue({ error: { name: 'rate_limit', statusCode: 429, message: 'no' } })
    expect((await send()).status).toBe(502)
    expect(mocks.store.read(DOC)).toBeUndefined()
    mocks.send.mockResolvedValue({ error: null })
    expect((await send()).status).toBe(200)
  })
})

describe('/api/auth/verify-signup-otp', () => {
  async function started() {
    await send({ lang: 'en' })
    return emailedCode()
  }
  const wrong = (code: string) => (code === '000000' ? '111111' : '000000')

  it('marks the email verified in Auth and the profile, deletes the code and answers a custom token', async () => {
    mocks.store.seed(`users/${UID}`, { email: EMAIL })
    const code = await started()
    const res = await verify(code)
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true, customToken: 'custom-token' })
    expect(mocks.updateUser).toHaveBeenCalledWith(UID, { emailVerified: true })
    expect(mocks.store.read(DOC)).toBeUndefined()
    expect(mocks.store.read(`users/${UID}`)?.emailVerifiedAt).toBeDefined()
  })

  it('is single use', async () => {
    const code = await started()
    expect((await verify(code)).status).toBe(200)
    const again = await verify(code)
    expect(again.status).toBe(409)
    expect((await again.json()).reason).toBe('noPending')
  })

  it('counts a wrong code and reports the attempts left, then locks after five without losing the cooldown', async () => {
    const code = await started()
    for (let i = 1; i < OTP_MAX_ATTEMPTS; i++) {
      const res = await verify(wrong(code))
      expect(res.status).toBe(400)
      expect(await res.json()).toMatchObject({ reason: 'invalidCode', attemptsLeft: OTP_MAX_ATTEMPTS - i })
    }
    const last = await verify(wrong(code))
    expect(last.status).toBe(429)
    expect((await last.json()).reason).toBe('tooManyAttempts')
    // Even the right code is refused now; the doc stays, so "Resend code" still waits out its minute.
    expect((await verify(code)).status).toBe(429)
    expect(mocks.store.read(DOC)).toBeDefined()
    expect((await send()).status).toBe(429)
    expect(mocks.updateUser).not.toHaveBeenCalled()
  })

  it('refuses an expired code with 410 and keeps the account unverified', async () => {
    const code = await started()
    mocks.store.seed(DOC, { ...mocks.store.read(DOC)!, expiresAt: Timestamp.fromMillis(Date.now() - 1000) })
    const res = await verify(code)
    expect(res.status).toBe(410)
    expect((await res.json()).reason).toBe('expired')
    expect(mocks.updateUser).not.toHaveBeenCalled()
  })

  it('rejects anything that is not six digits, and a request with no code sent', async () => {
    await started()
    for (const bad of ['12345', '1234567', 'abcdef', 123456, null]) expect((await (await verify(bad)).json()).reason).toBe('invalidCode')
    mocks.store = new MemoryFirestore()
    expect((await (await verify('123456')).json()).reason).toBe('noPending')
  })

  it('puts the code back when Auth is down, so the same code works afterwards', async () => {
    const code = await started()
    mocks.updateUser.mockRejectedValueOnce(new Error('down'))
    expect((await verify(code)).status).toBe(503)
    expect(mocks.store.read(DOC)).toBeDefined()
    expect((await verify(code)).status).toBe(200)
  })

  it('still verifies when the custom token cannot be minted (the client signs in with its password)', async () => {
    const code = await started()
    mocks.createCustomToken.mockRejectedValue(new Error('no'))
    const body = await (await verify(code)).json()
    expect(body.ok).toBe(true)
    expect(body.customToken).toBeUndefined()
  })

  it('answers ok for an account a link or another tab already verified', async () => {
    mocks.getUser.mockResolvedValue({ uid: UID, email: EMAIL, emailVerified: true, providerData: [{ providerId: 'password' }] })
    const res = await verify('123456')
    expect(await res.json()).toEqual({ ok: true, customToken: 'custom-token' })
    expect(mocks.updateUser).not.toHaveBeenCalled()
  })
})

describe('password-session compatibility', () => {
  it('keeps the account a password account: change-email keys off providerData, not the session’s sign-in provider', async () => {
    // Either sign-in after verifying (password, or the server's custom token) reaches the same member.
    for (const provider of ['password', 'custom']) {
      mocks.store = new MemoryFirestore()
      mocks.store.seed(`users/${UID}`, { email: EMAIL })
      mocks.token.mockResolvedValue({ uid: UID, auth_time: Math.floor(Date.now() / 1000), firebase: { sign_in_provider: provider } })
      mocks.getUser.mockResolvedValue({ uid: UID, email: EMAIL, emailVerified: true, providerData: [{ providerId: 'password' }] })
      const res = await changeEmail(post({ newEmail: `other-${provider}@example.com`, lang: 'en' }))
      expect((await res.json()).reason, provider).not.toBe('notPasswordAccount')
    }
  })

  it('re-signs in with the password first, and the custom token only when no password is held', () => {
    for (const path of ['components/auth/entrance/AuthScreen.tsx', 'landly-mobile/src/app/(auth)/login.tsx']) {
      const src = readFileSync(path, 'utf8')
      const handler = src.slice(src.indexOf('const handleOtpVerified'), src.indexOf('Back from the code'))
      expect(handler.indexOf('signInCustomerWithEmail(verified.email, password, lang)'), path).toBeGreaterThan(-1)
      expect(handler.indexOf('signInCustomerWithEmail('), path).toBeLessThan(handler.indexOf('signInCustomerWithCustomToken('))
      // A failed sign-in after a right code lands on Sign In with a notice, never a dead end.
      expect(handler).toContain("key: 'signupOtp_signInFailed'")
      expect(handler).toContain("switchMode('signIn')")
    }
  })
})

describe('client calls', () => {
  const fetchMock = vi.fn()
  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock)
  })
  afterEach(() => vi.unstubAllGlobals())

  it('posts to the sign-up routes with the ID token only (no address in the request)', async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 200, type: 'basic', url: '', json: async () => ({ ok: true, resendIn: 60, customToken: 't' }) })
    await requestSignupOtp('id-token', { lang: 'he' }, 'https://api.test')
    await signupOtpStatus('id-token', 'he', 'https://api.test')
    await verifySignupCode('id-token', '123456', 'https://api.test')
    expect(fetchMock.mock.calls.map((c) => c[0])).toEqual([
      'https://api.test/api/auth/send-signup-otp',
      'https://api.test/api/auth/send-signup-otp',
      'https://api.test/api/auth/verify-signup-otp',
    ])
    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual({ status: true, lang: 'he' })
    for (const call of fetchMock.mock.calls) {
      expect(call[1].headers.Authorization).toBe('Bearer id-token')
      expect(call[1].body).not.toContain('@')
    }
  })

  it('maps failures to sign-up copy, never to "change your number again"', () => {
    expect(contactChangeErrorKey('expired', 'signup')).toBe('signupOtp_err_expired')
    expect(contactChangeErrorKey('tooManyAttempts', 'signup')).toBe('signupOtp_err_tooManyAttempts')
    expect(contactChangeErrorKey('invalidCode', 'signup')).toBe('contact_err_invalidCode')
    expect(contactChangeErrorKey('offline', 'signup')).toBe('contact_err_offline')
  })
})

describe('copy and email', () => {
  it('has the sign-up code copy in every language, without emoji, with {time} and the countdown placeholder', () => {
    expect(LANGS.sort()).toEqual(['en', 'es', 'fr', 'he', 'ru'])
    for (const lang of LANGS) {
      const t = translations[lang]
      for (const key of ['otp_signup_title', 'otp_signup_subtitle', 'signupOtp_err_expired', 'signupOtp_err_tooManyAttempts', 'signupOtp_signInFailed', 'signupOtp_subject', 'signupOtp_heading', 'signupOtp_body', 'signupOtp_ignoreNote'] as const) {
        expect(t[key], `${lang}.${key}`).toBeTruthy()
        expect(t[key], `${lang}.${key}`).not.toMatch(/\p{Extended_Pictographic}/u)
      }
      expect(t.otp_resend_in, lang).toContain('{time}')
      expect(t.signupOtp_body, lang).toMatch(/10/)
      // A code, never a link.
      expect(t.signupOtp_body, lang).not.toMatch(/https?:/)
    }
    expect(translations.en.signupOtp_subject).not.toBe(translations.he.signupOtp_subject)
  })

  it('renders the code in its own left-to-right box, in Hebrew too, with no button', () => {
    for (const lang of ['he', 'en'] as const) {
      const html = renderBrandedEmail({ lang, origin: 'https://landly.test', ...buildSignupCodeEmail(lang, '482913') })
      expect(html).toContain('dir="ltr"')
      expect(html).toContain('482913')
      expect(html).toContain(translations[lang].signupOtp_heading)
      expect(html).not.toContain('/verify-email')
    }
  })

  it('hashes per member, so the same code for two accounts never matches', () => {
    expect(hashOtp('a', '123456')).not.toBe(hashOtp('b', '123456'))
  })
})

describe('firestore.rules', () => {
  it('keeps the sign-up codes server-only', () => {
    const rules = readFileSync('firestore.rules', 'utf8')
    expect(rules).toMatch(/match \/signupEmailVerifications\/\{userId\} \{\s*allow read, write: if false;\s*\}/)
    expect(rules).toContain("'emailVerifiedAt'")
  })
})

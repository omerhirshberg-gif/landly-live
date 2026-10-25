import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Timestamp } from 'firebase-admin/firestore'
import { MemoryFirestore } from '../helpers/memoryFirestore'

const mocks = vi.hoisted(() => ({
  store: null as unknown as MemoryFirestore,
  token: vi.fn(),
  getUser: vi.fn(),
  getUserByEmail: vi.fn(),
  updateUser: vi.fn(),
  revokeRefreshTokens: vi.fn(),
  createCustomToken: vi.fn(),
  send: vi.fn(),
  after: vi.fn(),
  updateSubscriberEmail: vi.fn(),
}))
// after() needs a request scope; here it records the callback and runs it at once.
vi.mock('next/server', async (importOriginal) => ({
  ...(await importOriginal<typeof import('next/server')>()),
  after: (task: () => unknown) => { mocks.after(task); void task() },
}))
vi.mock('@/lib/responder/updateSubscriberEmail', () => ({ updateSubscriberEmail: mocks.updateSubscriberEmail }))
vi.mock('resend', () => ({ Resend: class { emails = { send: mocks.send } } }))
vi.mock('@/lib/firebase/admin', () => ({
  getAdminDb: () => mocks.store.db,
  getAdminAuth: () => ({
    getUser: mocks.getUser, getUserByEmail: mocks.getUserByEmail, updateUser: mocks.updateUser,
    revokeRefreshTokens: mocks.revokeRefreshTokens, createCustomToken: mocks.createCustomToken,
  }),
}))
vi.mock('@/lib/firebase/verifyRequestUser', () => ({
  requireCustomer: mocks.token,
  RequestAuthError: class extends Error {
    constructor(message: string, public readonly status: number) { super(message) }
  },
}))
vi.mock('@/lib/auth/uidRateLimit', () => ({ checkUidRateLimit: () => null }))

import { POST as changeEmail } from '@/app/api/account/change-email/route'
import { POST as verifyEmailOtp } from '@/app/api/account/verify-email-otp/route'
import { POST as changePhone } from '@/app/api/account/change-phone/route'
import { POST as verifyPhoneOtp } from '@/app/api/account/verify-phone-otp/route'
import { POST as cancelPending } from '@/app/api/account/cancel-pending/route'
import { contactChangeErrorKey, requestEmailChange, requestPhoneChange, resendEndsChange, verifyEmailCode, verifyPhoneCode } from '@/lib/account/contactChange'
import { isOtpCode, normalizeOtpInput } from '@/lib/auth/otp'
import { normalizeEmail } from '@/lib/auth/emailChange'
import { buildEmailChangeCodeEmail } from '@/lib/email/sendEmailChangeEmail'
import { renderBrandedEmail } from '@/lib/email/brandedEmail'
import {
  devProvider,
  generateOtp,
  hashOtp,
  maskPhone,
  OtpDeliveryError,
  otpMatches,
  phoneVerificationMode,
  productionProvider,
} from '@/lib/auth/phoneVerification'
import { translations } from '@/lib/i18n/translations'

const UID = 'member-1'
const REVOKED_AT = 'Fri, 23 Oct 2026 10:00:05 GMT'
const nowSeconds = () => Math.floor(Date.now() / 1000)

function post(body: unknown) {
  return new Request('https://landly.test/api', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer token' },
    body: JSON.stringify(body),
  })
}

let info: ReturnType<typeof vi.spyOn>
const lastLoggedCode = () => {
  const line = String(info.mock.calls.at(-1)?.[0] ?? '')
  return line.match(/code (\d{6})$/)?.[1] ?? ''
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.store = new MemoryFirestore()
  mocks.store.seed(`users/${UID}`, { email: 'old@landly.test', phone: '+972501234567' })
  mocks.token.mockResolvedValue({ uid: UID, auth_time: nowSeconds(), firebase: { sign_in_provider: 'password' } })
  mocks.getUser.mockResolvedValue({ email: 'old@landly.test', providerData: [{ providerId: 'password' }], tokensValidAfterTime: REVOKED_AT })
  mocks.revokeRefreshTokens.mockResolvedValue(undefined)
  mocks.createCustomToken.mockResolvedValue('fresh-custom-token')
  mocks.getUserByEmail.mockRejectedValue(Object.assign(new Error('none'), { code: 'auth/user-not-found' }))
  mocks.updateUser.mockResolvedValue({})
  mocks.send.mockResolvedValue({ error: null })
  mocks.updateSubscriberEmail.mockResolvedValue('created')
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

describe('OTP helpers', () => {
  it('keeps only the digits of a typed, pasted or autofilled code', () => {
    expect(normalizeOtpInput('123 456')).toBe('123456')
    expect(normalizeOtpInput('Your Landly code is 987-654.')).toBe('987654')
    expect(normalizeOtpInput('12345678')).toBe('123456')
    expect(isOtpCode('012345')).toBe(true)
    expect(isOtpCode('12345')).toBe(false)
  })

  it('generates 6-digit codes and compares them by salted hash', () => {
    for (let i = 0; i < 50; i++) expect(generateOtp()).toMatch(/^\d{6}$/)
    const hash = hashOtp(UID, '123456')
    expect(hash).not.toContain('123456')
    expect(otpMatches(UID, '123456', hash)).toBe(true)
    expect(otpMatches(UID, '123457', hash)).toBe(false)
    expect(otpMatches('someone-else', '123456', hash)).toBe(false)
  })

  it('never logs a whole number', () => {
    expect(maskPhone('+14155552671')).toBe('+14 •••• 2671')
  })
})

describe('phoneVerificationMode', () => {
  it('verifies in development unless the flag is explicitly off', () => {
    expect(phoneVerificationMode()).toBe('otp')
    vi.stubEnv('FIREBASE_PHONE_AUTH_ENABLED', 'false')
    expect(phoneVerificationMode()).toBe('direct')
  })

  it('saves directly in production until the flag is on and WhatsApp is configured', () => {
    vi.stubEnv('NODE_ENV', 'production')
    expect(phoneVerificationMode()).toBe('direct')
    vi.stubEnv('FIREBASE_PHONE_AUTH_ENABLED', 'true')
    expect(phoneVerificationMode()).toBe('direct')
    vi.stubEnv('WHATSAPP_ACCESS_TOKEN', 'token')
    vi.stubEnv('WHATSAPP_PHONE_NUMBER_ID', '123')
    vi.stubEnv('WHATSAPP_OTP_TEMPLATE', 'landly_code')
    expect(phoneVerificationMode()).toBe('otp')
  })
})

describe('OTP providers', () => {
  it('devProvider simulates WhatsApp by logging the code', async () => {
    await devProvider.send({ phone: '+33612345678', code: '424242', channel: 'whatsapp', lang: 'fr' })
    expect(info.mock.calls.at(-1)?.[0]).toBe('[phone-otp] simulated WhatsApp to +33 •••• 5678: code 424242')
  })

  it('productionProvider sends a WhatsApp authentication template with the code', async () => {
    vi.stubEnv('WHATSAPP_ACCESS_TOKEN', 'secret')
    vi.stubEnv('WHATSAPP_PHONE_NUMBER_ID', '555')
    vi.stubEnv('WHATSAPP_OTP_TEMPLATE', 'landly_code')
    const fetchMock = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    await productionProvider.send({ phone: '+79161234567', code: '111222', channel: 'whatsapp', lang: 'ru' })
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('https://graph.facebook.com/v21.0/555/messages')
    expect(init.headers.Authorization).toBe('Bearer secret')
    const body = JSON.parse(init.body)
    expect(body).toMatchObject({ messaging_product: 'whatsapp', to: '79161234567', type: 'template', template: { name: 'landly_code', language: { code: 'ru' } } })
    expect(JSON.stringify(body.template.components)).toContain('111222')
    vi.unstubAllGlobals()
  })

  it('productionProvider reports a refused send and the unconfigured SMS channel', async () => {
    vi.stubEnv('WHATSAPP_ACCESS_TOKEN', 'secret')
    vi.stubEnv('WHATSAPP_PHONE_NUMBER_ID', '555')
    vi.stubEnv('WHATSAPP_OTP_TEMPLATE', 'landly_code')
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: { code: 131026, message: 'undeliverable' } }), { status: 400 })))
    await expect(productionProvider.send({ phone: '+12025550123', code: '1', channel: 'whatsapp', lang: 'en' })).rejects.toMatchObject({ code: '131026' })
    await expect(productionProvider.send({ phone: '+12025550123', code: '1', channel: 'sms', lang: 'en' })).rejects.toBeInstanceOf(OtpDeliveryError)
    vi.unstubAllGlobals()
  })
})

describe('/api/account/change-phone', () => {
  it.each([
    ['US', '+1 202 555 0123', '+12025550123'],
    ['France', '+33 6 12 34 56 78', '+33612345678'],
    ['Russia', '+7 916 123-45-67', '+79161234567'],
    ['UK', '+44 7911 123456', '+447911123456'],
  ])('accepts an international number (%s) as E.164 and sends a WhatsApp code', async (_country, input, e164) => {
    const res = await changePhone(post({ phone: input, lang: 'en' }))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true, mode: 'otp', channel: 'whatsapp', resendIn: 60 })
    expect(mocks.store.read(`users/${UID}`)).toMatchObject({ phone: '+972501234567', pendingPhone: e164 })
    const verification = mocks.store.read(`phoneVerifications/${UID}`)!
    expect(verification).toMatchObject({ phone: e164, channel: 'whatsapp', attempts: 0 })
    expect(verification.codeHash).toBe(hashOtp(UID, lastLoggedCode()))
  })

  it('refuses invalid or national-only numbers', async () => {
    for (const phone of ['050-123-4567', '+1 555', 'hello', '']) {
      const res = await changePhone(post({ phone }))
      expect(res.status).toBe(400)
      expect((await res.json()).reason).toBe('invalidPhone')
    }
  })

  it('answers direct (the client saves as before) when verification is off', async () => {
    vi.stubEnv('FIREBASE_PHONE_AUTH_ENABLED', 'false')
    const res = await changePhone(post({ phone: '+12025550123' }))
    expect(await res.json()).toEqual({ ok: true, mode: 'direct' })
    expect(mocks.store.read(`users/${UID}`)?.pendingPhone).toBeUndefined()
    expect(mocks.store.read(`phoneVerifications/${UID}`)).toBeUndefined()
  })

  it('waits a minute between codes', async () => {
    await changePhone(post({ phone: '+12025550123' }))
    const res = await changePhone(post({ phone: '+12025550123' }))
    expect(res.status).toBe(429)
    expect((await res.json()).retryAfter).toBeGreaterThan(50)
  })

  it('refuses a number already on another account, before any code goes out', async () => {
    mocks.store.seed('users/member-2', { email: 'other@landly.test', phone: '+12025550123' })
    const res = await changePhone(post({ phone: '+12025550123' }))
    expect(res.status).toBe(409)
    expect((await res.json()).reason).toBe('phoneInUse')
    expect(mocks.store.read(`users/${UID}`)?.pendingPhone).toBeUndefined()
    expect(mocks.store.read(`phoneVerifications/${UID}`)).toBeUndefined()
    expect(lastLoggedCode()).toBe('')
  })

  it('leaves nothing pending when the code cannot be delivered', async () => {
    vi.spyOn(devProvider, 'send').mockRejectedValueOnce(new OtpDeliveryError('whatsapp', '131026', 'undeliverable'))
    const res = await changePhone(post({ phone: '+12025550123' }))
    expect(res.status).toBe(502)
    expect((await res.json()).reason).toBe('delivery')
    expect(mocks.store.read(`users/${UID}`)?.pendingPhone).toBeUndefined()
    expect(mocks.store.read(`phoneVerifications/${UID}`)).toBeUndefined()
  })

  it('answers delivery, not a server error, when Meta has the template in no language (132001)', async () => {
    vi.stubEnv('WHATSAPP_OTP_LIVE', 'true')
    vi.stubEnv('WHATSAPP_ACCESS_TOKEN', 'secret')
    vi.stubEnv('WHATSAPP_PHONE_NUMBER_ID', '555')
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const meta = () => new Response(JSON.stringify({ error: { code: 132001, message: 'Template name does not exist in the translation' } }), { status: 400 })
    const fetchMock = vi.fn().mockImplementation(async () => meta())
    vi.stubGlobal('fetch', fetchMock)
    const res = await changePhone(post({ phone: '+12025550123', lang: 'he' }))
    expect(res.status).toBe(502)
    expect(await res.json()).toMatchObject({ reason: 'delivery', channel: 'whatsapp' })
    expect(fetchMock.mock.calls.map(([, init]) => JSON.parse(init.body).template.language.code)).toEqual(['he', 'en_US', 'en'])
    expect(mocks.store.read(`users/${UID}`)?.pendingPhone).toBeUndefined()
    expect(mocks.store.read(`phoneVerifications/${UID}`)).toBeUndefined()
    vi.unstubAllGlobals()
  })

  it('a resend that could not be delivered drops the code sent before, so the dialog closes', async () => {
    await changePhone(post({ phone: '+12025550123' }))
    expect(mocks.store.read(`phoneVerifications/${UID}`)).toBeDefined()
    mocks.store.seed(`phoneVerifications/${UID}`, { ...mocks.store.read(`phoneVerifications/${UID}`), lastSentAt: Timestamp.fromMillis(Date.now() - 61_000) })
    vi.spyOn(devProvider, 'send').mockRejectedValueOnce(new OtpDeliveryError('whatsapp', '132001', 'no translation'))
    const res = await changePhone(post({ phone: '+12025550123' }))
    const body = await res.json()
    expect(body.reason).toBe('delivery')
    expect(resendEndsChange(body.reason)).toBe(true)
    expect(mocks.store.read(`users/${UID}`)?.pendingPhone).toBeUndefined()
    expect(mocks.store.read(`phoneVerifications/${UID}`)).toBeUndefined()
  })
})

describe('resendEndsChange', () => {
  it('closes the verification dialog only when nothing is left to verify', () => {
    expect(resendEndsChange('delivery')).toBe(true)
    expect(resendEndsChange('noPending')).toBe(true)
    for (const reason of ['rateLimited', 'offline', 'failed', 'unauthorized', 'invalidCode'] as const) expect(resendEndsChange(reason), reason).toBe(false)
  })
})

describe('/api/account/verify-phone-otp', () => {
  it('moves the verified number into phone and clears the pending change', async () => {
    await changePhone(post({ phone: '+447911123456' }))
    const res = await verifyPhoneOtp(post({ code: lastLoggedCode() }))
    expect(await res.json()).toEqual({ ok: true, phone: '+447911123456' })
    const user = mocks.store.read(`users/${UID}`)!
    expect(user.phone).toBe('+447911123456')
    expect(user.phoneVerified).toBe(true)
    expect(user).not.toHaveProperty('pendingPhone')
    expect(user).not.toHaveProperty('pendingPhoneRequestedAt')
    expect(mocks.store.read(`phoneVerifications/${UID}`)).toBeUndefined()
  })

  it('drops the change when another member took the number meanwhile', async () => {
    await changePhone(post({ phone: '+447911123456' }))
    mocks.store.seed('users/member-2', { email: 'other@landly.test', phone: '+447911123456' })
    const res = await verifyPhoneOtp(post({ code: lastLoggedCode() }))
    expect(res.status).toBe(409)
    expect((await res.json()).reason).toBe('phoneInUse')
    const user = mocks.store.read(`users/${UID}`)!
    expect(user.phone).toBe('+972501234567')
    expect(user).not.toHaveProperty('phoneVerified')
    expect(user).not.toHaveProperty('pendingPhone')
    expect(mocks.store.read(`phoneVerifications/${UID}`)).toBeUndefined()
  })

  it('counts wrong codes and gives up after five', async () => {
    await changePhone(post({ phone: '+447911123456' }))
    const wrong = lastLoggedCode() === '000000' ? '111111' : '000000'
    for (const left of [4, 3, 2, 1]) {
      const res = await verifyPhoneOtp(post({ code: wrong }))
      expect(res.status).toBe(400)
      expect(await res.json()).toMatchObject({ reason: 'invalidCode', attemptsLeft: left })
    }
    const last = await verifyPhoneOtp(post({ code: wrong }))
    expect((await last.json()).reason).toBe('tooManyAttempts')
    expect(mocks.store.read(`users/${UID}`)).toMatchObject({ phone: '+972501234567' })
    expect(mocks.store.read(`users/${UID}`)?.pendingPhone).toBeUndefined()
  })

  it('refuses an expired code and clears the pending change', async () => {
    await changePhone(post({ phone: '+447911123456' }))
    const code = lastLoggedCode()
    mocks.store.seed(`phoneVerifications/${UID}`, { ...mocks.store.read(`phoneVerifications/${UID}`), expiresAt: Timestamp.fromMillis(Date.now() - 1) })
    const res = await verifyPhoneOtp(post({ code }))
    expect(res.status).toBe(410)
    expect(mocks.store.read(`users/${UID}`)?.phone).toBe('+972501234567')
    expect(mocks.store.read(`users/${UID}`)?.pendingPhone).toBeUndefined()
  })

  it('answers noPending without a change, and refuses malformed codes', async () => {
    expect((await (await verifyPhoneOtp(post({ code: '123456' }))).json()).reason).toBe('noPending')
    expect((await verifyPhoneOtp(post({ code: '12a456' }))).status).toBe(400)
  })
})

// The code as it appears in the email's big left-to-right box.
const CODE_IN_EMAIL = /letter-spacing:10px;color:#0F172A;">(\d{6})</
const emailedCode = (call = mocks.send.mock.calls.at(-1)!) => (call[0].html as string).match(CODE_IN_EMAIL)?.[1] ?? ''
const ago = (ms: number) => Timestamp.fromMillis(Date.now() - ms)

describe('/api/account/change-email', () => {
  it('stores only the code hash, marks the address pending and mails a 6-digit code to the new inbox', async () => {
    const res = await changeEmail(post({ newEmail: '  New@Landly.test ', lang: 'he' }))
    expect(await res.json()).toEqual({ ok: true, pendingEmail: 'new@landly.test', resendIn: 60 })
    expect(mocks.store.read(`users/${UID}`)).toMatchObject({ email: 'old@landly.test', pendingEmail: 'new@landly.test' })
    expect(mocks.updateUser).not.toHaveBeenCalled()

    const sent = mocks.send.mock.calls[0][0]
    expect(sent.to).toBe('new@landly.test')
    expect(sent.subject).toBe(translations.he.emailChange_subject)
    expect(sent.html).not.toContain('confirm-email-change')
    const code = emailedCode()
    expect(isOtpCode(code)).toBe(true)
    const request = mocks.store.read(`emailChangeRequests/${UID}`)!
    expect(request).toMatchObject({ newEmail: 'new@landly.test', codeHash: hashOtp(UID, code), attempts: 0, lang: 'he' })
    expect((request.expiresAt as Timestamp).toMillis() - Date.now()).toBeGreaterThan(9 * 60_000)
    expect(JSON.stringify(request)).not.toContain(code)
    expect(JSON.stringify(mocks.store.read(`users/${UID}`))).not.toContain(code)
  })

  it('needs a recent password sign-in, a password account and a free, different address', async () => {
    mocks.token.mockResolvedValueOnce({ uid: UID, auth_time: nowSeconds() - 3600, firebase: {} })
    expect((await (await changeEmail(post({ newEmail: 'new@landly.test' }))).json()).reason).toBe('reauthRequired')

    mocks.getUser.mockResolvedValueOnce({ email: 'old@landly.test', providerData: [{ providerId: 'google.com' }] })
    expect((await (await changeEmail(post({ newEmail: 'new@landly.test' }))).json()).reason).toBe('notPasswordAccount')

    // Google linked beside a password: the address is still the Google identity.
    mocks.getUser.mockResolvedValueOnce({ email: 'old@landly.test', providerData: [{ providerId: 'password' }, { providerId: 'google.com' }] })
    expect((await (await changeEmail(post({ newEmail: 'new@landly.test' }))).json()).reason).toBe('notPasswordAccount')

    expect((await (await changeEmail(post({ newEmail: 'OLD@landly.test' }))).json()).reason).toBe('sameEmail')
    expect((await (await changeEmail(post({ newEmail: 'not-an-email' }))).json()).reason).toBe('invalidEmail')

    mocks.getUserByEmail.mockResolvedValueOnce({ uid: 'someone-else' })
    expect((await (await changeEmail(post({ newEmail: 'taken@landly.test' }))).json()).reason).toBe('emailInUse')
    expect(mocks.send).not.toHaveBeenCalled()
  })

  it('resends a fresh code to the pending address without the password, at most once a minute', async () => {
    await changeEmail(post({ newEmail: 'new@landly.test' }))
    const first = emailedCode()
    mocks.token.mockResolvedValue({ uid: UID, auth_time: nowSeconds() - 3600, firebase: {} })
    const tooSoon = await changeEmail(post({ resend: true }))
    expect(tooSoon.status).toBe(429)
    expect((await tooSoon.json()).retryAfter).toBeGreaterThan(55)

    mocks.store.seed(`emailChangeRequests/${UID}`, { ...mocks.store.read(`emailChangeRequests/${UID}`), lastSentAt: ago(61_000), attempts: 3 })
    const res = await changeEmail(post({ resend: true }))
    expect(await res.json()).toEqual({ ok: true, pendingEmail: 'new@landly.test', resendIn: 60 })
    expect(mocks.send).toHaveBeenCalledTimes(2)
    expect(mocks.send.mock.calls[1][0].to).toBe('new@landly.test')
    // A new code with a fresh set of attempts; the previous code no longer matches.
    const request = mocks.store.read(`emailChangeRequests/${UID}`)!
    expect(request.attempts).toBe(0)
    expect(request.codeHash).toBe(hashOtp(UID, emailedCode()))
    if (emailedCode() !== first) expect(otpMatches(UID, first, request.codeHash as string)).toBe(false)
  })

  it('sends one code a minute whatever the address', async () => {
    await changeEmail(post({ newEmail: 'new@landly.test' }))
    const again = await changeEmail(post({ newEmail: 'other@landly.test' }))
    expect(again.status).toBe(429)
    expect(mocks.send).toHaveBeenCalledTimes(1)
    expect(mocks.store.read(`users/${UID}`)?.pendingEmail).toBe('new@landly.test')
  })

  it('answers noPending for a resend with nothing pending', async () => {
    expect((await (await changeEmail(post({ resend: true }))).json()).reason).toBe('noPending')
  })
})

describe('/api/account/verify-email-otp', () => {
  async function startChange() {
    await changeEmail(post({ newEmail: 'new@landly.test', lang: 'fr' }))
    return emailedCode()
  }
  const verify = (code: string) => verifyEmailOtp(post({ code }))
  const wrong = (code: string) => (code === '000000' ? '111111' : '000000')

  it('applies the change in Auth and Firestore once, then alerts the previous address', async () => {
    const code = await startChange()
    const res = await verify(code)
    expect(await res.json()).toEqual({ ok: true, email: 'new@landly.test', customToken: 'fresh-custom-token' })
    expect(mocks.updateUser).toHaveBeenCalledWith(UID, { email: 'new@landly.test', emailVerified: true })
    const user = mocks.store.read(`users/${UID}`)!
    expect(user.email).toBe('new@landly.test')
    expect(user).not.toHaveProperty('pendingEmail')
    expect(user).not.toHaveProperty('pendingEmailRequestedAt')
    expect(mocks.store.read(`emailChangeRequests/${UID}`)).toBeUndefined()

    const alert = mocks.send.mock.calls.at(-1)![0]
    expect(alert.to).toBe('old@landly.test')
    expect(alert.subject).toBe(translations.fr.emailChanged_subject)
    expect(alert.html).toContain('new@landly.test')

    const again = await verify(code)
    expect(again.status).toBe(409)
    expect((await again.json()).reason).toBe('noPending')
    expect(mocks.updateUser).toHaveBeenCalledTimes(1)
  })

  it('ends every session, Firestore included, and hands this device a token to sign back in', async () => {
    const res = await verify(await startChange())
    expect((await res.json()).customToken).toBe('fresh-custom-token')
    expect(mocks.revokeRefreshTokens).toHaveBeenCalledWith(UID)
    expect(mocks.createCustomToken).toHaveBeenCalledWith(UID)
    // The cutoff the rules compare auth_time with is Auth's own, to the second.
    const stamp = mocks.store.read(`users/${UID}`)!.sessionsValidAfter as Timestamp
    expect(stamp.toMillis()).toBe(Date.parse(REVOKED_AT))
    expect(mocks.revokeRefreshTokens.mock.invocationCallOrder[0]).toBeGreaterThan(mocks.updateUser.mock.invocationCallOrder[0])
  })

  it('still applies the change when the sessions cannot be ended, without a token', async () => {
    mocks.revokeRefreshTokens.mockRejectedValueOnce(new Error('auth down'))
    const res = await verify(await startChange())
    expect(await res.json()).toEqual({ ok: true, email: 'new@landly.test' })
    expect(mocks.store.read(`users/${UID}`)!.email).toBe('new@landly.test')
    expect(mocks.createCustomToken).not.toHaveBeenCalled()
  })

  it('never ends sessions when the code does not apply', async () => {
    await startChange()
    await verify('000000').catch(() => {})
    await verify('111111').catch(() => {})
    expect(mocks.revokeRefreshTokens).not.toHaveBeenCalled()
    expect(mocks.createCustomToken).not.toHaveBeenCalled()
  })

  it('carries the new address to Responder in the background for a member who opted in', async () => {
    mocks.store.seed(`users/${UID}`, { email: 'old@landly.test', firstName: 'Dana', marketingOptIn: true })
    const code = await startChange()
    expect(await (await verify(code)).json()).toEqual({ ok: true, email: 'new@landly.test', customToken: 'fresh-custom-token' })
    expect(mocks.after).toHaveBeenCalledTimes(1)
    expect(mocks.updateSubscriberEmail).toHaveBeenCalledWith({ uid: UID, oldEmail: 'old@landly.test', newEmail: 'new@landly.test', firstName: 'Dana' })
  })

  it('never syncs a member who did not opt in', async () => {
    mocks.store.seed(`users/${UID}`, { email: 'old@landly.test', firstName: 'Dana', marketingOptIn: 'yes' })
    expect((await verify(await startChange())).status).toBe(200)
    expect(mocks.after).not.toHaveBeenCalled()
    expect(mocks.updateSubscriberEmail).not.toHaveBeenCalled()
  })

  it('does not wait on Responder: a hung sync still verifies', async () => {
    mocks.store.seed(`users/${UID}`, { email: 'old@landly.test', marketingOptIn: true })
    mocks.updateSubscriberEmail.mockReturnValueOnce(new Promise(() => {}))
    expect(await (await verify(await startChange())).json()).toEqual({ ok: true, email: 'new@landly.test', customToken: 'fresh-custom-token' })
    expect(mocks.updateSubscriberEmail).toHaveBeenCalledWith(expect.objectContaining({ firstName: '' }))
  })

  it('does not sync when the change does not apply', async () => {
    mocks.store.seed(`users/${UID}`, { email: 'old@landly.test', marketingOptIn: true })
    const code = await startChange()
    expect((await verify(wrong(code))).status).toBe(400)
    mocks.updateUser.mockRejectedValueOnce(new Error('down'))
    expect((await verify(code)).status).toBe(503)
    mocks.updateUser.mockRejectedValueOnce(Object.assign(new Error('taken'), { code: 'auth/email-already-exists' }))
    expect((await verify(code)).status).toBe(409)
    expect(mocks.updateSubscriberEmail).not.toHaveBeenCalled()
  })

  it('counts wrong codes and gives up after five', async () => {
    const code = await startChange()
    for (let left = 4; left >= 1; left--) {
      const res = await verify(wrong(code))
      expect(res.status).toBe(400)
      expect(await res.json()).toMatchObject({ reason: 'invalidCode', attemptsLeft: left })
    }
    const last = await verify(wrong(code))
    expect(last.status).toBe(429)
    expect((await last.json()).reason).toBe('tooManyAttempts')
    expect(mocks.store.read(`users/${UID}`)?.pendingEmail).toBeUndefined()
    expect(mocks.store.read(`emailChangeRequests/${UID}`)).toBeUndefined()
    // Even the right code is useless now.
    expect((await verify(code)).status).toBe(409)
    expect(mocks.updateUser).not.toHaveBeenCalled()
  })

  it('refuses an expired code and clears the pending change', async () => {
    const code = await startChange()
    mocks.store.seed(`emailChangeRequests/${UID}`, { ...mocks.store.read(`emailChangeRequests/${UID}`), expiresAt: ago(1) })
    const res = await verify(code)
    expect(res.status).toBe(410)
    expect((await res.json()).reason).toBe('expired')
    expect(mocks.updateUser).not.toHaveBeenCalled()
    expect(mocks.store.read(`users/${UID}`)?.pendingEmail).toBeUndefined()
  })

  it('answers noPending without a change, for a link-era request, or when the pending address moved on, and refuses malformed codes', async () => {
    expect((await verify('123456')).status).toBe(409)

    // A request from before codes replaced links carries a token hash only.
    mocks.store.seed(`users/${UID}`, { email: 'old@landly.test', pendingEmail: 'new@landly.test' })
    mocks.store.seed(`emailChangeRequests/${UID}`, { newEmail: 'new@landly.test', tokenHash: 'f'.repeat(64), expiresAt: Timestamp.fromMillis(Date.now() + 60_000) })
    expect((await (await verify('123456')).json()).reason).toBe('noPending')
    expect(mocks.store.read(`emailChangeRequests/${UID}`)).toBeUndefined()

    const code = await startChange()
    mocks.store.seed(`users/${UID}`, { email: 'old@landly.test', pendingEmail: 'elsewhere@landly.test' })
    expect((await (await verify(code)).json()).reason).toBe('noPending')

    for (const bad of ['12345', '1234567', 'abcdef', 123456, null]) {
      expect((await (await verifyEmailOtp(post({ code: bad }))).json()).reason).toBe('invalidCode')
    }
    expect(mocks.updateUser).not.toHaveBeenCalled()
  })

  it('drops the change when the address was taken meanwhile', async () => {
    const code = await startChange()
    mocks.updateUser.mockRejectedValueOnce(Object.assign(new Error('taken'), { code: 'auth/email-already-exists' }))
    const res = await verify(code)
    expect((await res.json()).reason).toBe('emailInUse')
    expect(mocks.store.read(`users/${UID}`)).toMatchObject({ email: 'old@landly.test' })
    expect(mocks.store.read(`users/${UID}`)?.pendingEmail).toBeUndefined()
  })

  it('keeps the code usable when Auth is briefly unavailable', async () => {
    const code = await startChange()
    mocks.updateUser.mockRejectedValueOnce(Object.assign(new Error('down'), { code: 'auth/internal-error' }))
    expect((await verify(code)).status).toBe(503)
    expect(mocks.store.read(`users/${UID}`)?.pendingEmail).toBe('new@landly.test')
    expect((await verify(code)).status).toBe(200)
    expect(mocks.store.read(`users/${UID}`)?.email).toBe('new@landly.test')
  })

  it('never logs the code or either address', async () => {
    const error = vi.mocked(console.error)
    const code = await startChange()
    mocks.updateUser.mockRejectedValueOnce(Object.assign(new Error('down'), { code: 'auth/internal-error' }))
    await verify(code)
    const logged = error.mock.calls.map((c) => c.join(' ')).join('\n')
    expect(logged).toContain('step=auth')
    expect(logged).not.toContain(code)
    expect(logged).not.toContain('new@landly.test')
    expect(logged).not.toContain('old@landly.test')
  })
})

describe('email change code email', () => {
  it('shows the code in a left-to-right box with no button or link to click', () => {
    const { subject, ...content } = buildEmailChangeCodeEmail('en', '012345')
    expect(subject).toBe(translations.en.emailChange_subject)
    const html = renderBrandedEmail({ lang: 'en', origin: 'https://landly.test', ...content })
    expect(html).toMatch(/<p dir="ltr"[^>]*>012345<\/p>/)
    expect(html).toContain(translations.en.emailChange_codeLabel)
    expect(html).toContain(translations.en.emailChange_ignoreNote)
    expect(html).not.toContain('v:roundrect')
    expect(html).not.toContain(translations.en.email_linkFallback)
    expect(html).not.toContain('href=""')
  })

  it('renders Hebrew right-to-left around the left-to-right code', () => {
    const { subject: _subject, ...content } = buildEmailChangeCodeEmail('he', '987654')
    const html = renderBrandedEmail({ lang: 'he', origin: 'https://landly.test', ...content })
    expect(html).toContain('<html lang="he" dir="rtl"')
    expect(html).toMatch(/<p dir="ltr"[^>]*>987654<\/p>/)
    expect(html).toContain(translations.he.emailChange_codeLabel)
  })

  it('keeps the button in emails that have one', () => {
    const html = renderBrandedEmail({ lang: 'en', origin: 'https://landly.test', heading: 'H', body: 'B', buttonLabel: 'Go', buttonLink: 'https://landly.test/go', footnote: 'F' })
    expect(html).toContain('v:roundrect')
    expect(html).toContain('href="https://landly.test/go"')
    expect(html).toContain(translations.en.email_linkFallback)
  })
})

describe('/api/account/cancel-pending', () => {
  it('drops a pending email or phone and its server-side token', async () => {
    await changeEmail(post({ newEmail: 'new@landly.test' }))
    await changePhone(post({ phone: '+12025550123' }))
    await cancelPending(post({ kind: 'email' }))
    await cancelPending(post({ kind: 'phone' }))
    expect(mocks.store.read(`users/${UID}`)).toEqual({ email: 'old@landly.test', phone: '+972501234567' })
    expect(mocks.store.read(`emailChangeRequests/${UID}`)).toBeUndefined()
    expect(mocks.store.read(`phoneVerifications/${UID}`)).toBeUndefined()
    expect((await cancelPending(post({ kind: 'name' }))).status).toBe(400)
  })
})

describe('email change address', () => {
  it('normalizes addresses', () => {
    expect(normalizeEmail(' A@B.co ')).toBe('a@b.co')
    expect(normalizeEmail('a@b')).toBeNull()
    expect(normalizeEmail(42)).toBeNull()
  })
})

describe('client caller (lib/account/contactChange.ts)', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('passes server reasons through and maps transport failures', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ reason: 'invalidCode', attemptsLeft: 2 }), { status: 400 })))
    expect(await verifyPhoneCode('t', '000000')).toEqual({ ok: false, reason: 'invalidCode', attemptsLeft: 2 })

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true, mode: 'direct' }), { status: 200 })))
    expect(await requestPhoneChange('t', { phone: '+12025550123', lang: 'en' })).toEqual({ ok: true, mode: 'direct' })

    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Network request failed')))
    expect(await verifyEmailCode('t', '123456')).toEqual({ ok: false, reason: 'offline' })

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('', { status: 429 })))
    expect(await requestEmailChange('t', { newEmail: 'new@landly.test', lang: 'en' })).toEqual({ ok: false, reason: 'rateLimited' })

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ reason: 'rateLimited', retryAfter: 42 }), { status: 429 })))
    expect(await requestEmailChange('t', { newEmail: 'new@landly.test', lang: 'en' })).toEqual({ ok: false, reason: 'rateLimited', retryAfter: 42 })
  })

  it('sends the email code with the session to the email verify route, through the app base URL', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true, email: 'new@landly.test' }), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    expect(await verifyEmailCode('id-token', '123456', 'https://api.landly.test/')).toEqual({ ok: true, email: 'new@landly.test' })
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('https://api.landly.test/api/account/verify-email-otp')
    expect(init.headers).toMatchObject({ Authorization: 'Bearer id-token' })
    expect(JSON.parse(init.body)).toEqual({ code: '123456' })
  })

  it('names the email in the expired and used-up copy for an email change', () => {
    expect(contactChangeErrorKey('expired', 'email')).toBe('contact_err_expired_email')
    expect(contactChangeErrorKey('tooManyAttempts', 'email')).toBe('contact_err_tooManyAttempts_email')
    expect(contactChangeErrorKey('expired')).toBe('contact_err_expired')
    expect(contactChangeErrorKey('invalidCode', 'email')).toBe('contact_err_invalidCode')
  })

  it('maps every reason to copy that exists in all languages', () => {
    const reasons = ['rateLimited', 'unauthorized', 'reauthRequired', 'notPasswordAccount', 'invalidEmail', 'sameEmail', 'emailInUse', 'invalidPhone', 'samePhone', 'delivery', 'noPending', 'invalidCode', 'expired', 'tooManyAttempts', 'invalid', 'failed', 'offline'] as const
    for (const lang of Object.keys(translations) as (keyof typeof translations)[]) {
      for (const reason of reasons) {
        expect(translations[lang][contactChangeErrorKey(reason)], `${lang}.${reason}`).toBeTruthy()
        expect(translations[lang][contactChangeErrorKey(reason, 'email')], `${lang}.${reason} (email)`).toBeTruthy()
      }
    }
  })
})

describe('copy', () => {
  it('keeps the value placeholders in every language, so the number or address is always isolated', () => {
    for (const lang of Object.keys(translations) as (keyof typeof translations)[]) {
      const t = translations[lang]
      expect(t.pending_email_body, lang).toContain('{email}')
      expect(t.pending_phone_body, lang).toContain('{phone}')
      expect(t.emailChanged_body, lang).toContain('{email}')
      expect(t.otp_resend_in, lang).toContain('{seconds}')
      expect(t.otp_title, lang).toContain('💬')
      for (const key of ['otp_email_title', 'otp_email_subtitle', 'otp_email_success', 'pending_email_enter', 'emailChange_codeLabel'] as const) {
        expect(t[key], `${lang}.${key}`).toBeTruthy()
      }
      // The email copy describes a code, never a link to click.
      expect(t.emailChange_body, lang).toMatch(/10/)
    }
  })
})

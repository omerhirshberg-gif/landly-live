import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Timestamp } from 'firebase-admin/firestore'
import { MemoryFirestore } from '../helpers/memoryFirestore'

const mocks = vi.hoisted(() => ({
  store: null as unknown as MemoryFirestore,
  token: vi.fn(),
  getUser: vi.fn(),
  getUserByEmail: vi.fn(),
  updateUser: vi.fn(),
  send: vi.fn(),
}))
vi.mock('resend', () => ({ Resend: class { emails = { send: mocks.send } } }))
vi.mock('@/lib/firebase/admin', () => ({
  getAdminDb: () => mocks.store.db,
  getAdminAuth: () => ({ getUser: mocks.getUser, getUserByEmail: mocks.getUserByEmail, updateUser: mocks.updateUser }),
}))
vi.mock('@/lib/firebase/verifyRequestUser', () => ({
  requireCustomer: mocks.token,
  RequestAuthError: class extends Error {
    constructor(message: string, public readonly status: number) { super(message) }
  },
}))
vi.mock('@/lib/auth/uidRateLimit', () => ({ checkUidRateLimit: () => null }))

import { POST as changeEmail } from '@/app/api/account/change-email/route'
import { POST as verifyEmailChange } from '@/app/api/account/verify-email-change/route'
import { POST as changePhone } from '@/app/api/account/change-phone/route'
import { POST as verifyPhoneOtp } from '@/app/api/account/verify-phone-otp/route'
import { POST as cancelPending } from '@/app/api/account/cancel-pending/route'
import { confirmEmailChange, contactChangeErrorKey, requestPhoneChange, verifyPhoneCode } from '@/lib/account/contactChange'
import { isOtpCode, normalizeOtpInput } from '@/lib/auth/otp'
import { createEmailChangeToken, hashEmailChangeToken, isEmailChangeToken, normalizeEmail } from '@/lib/auth/emailChangeToken'
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
  mocks.getUser.mockResolvedValue({ email: 'old@landly.test', providerData: [{ providerId: 'password' }] })
  mocks.getUserByEmail.mockRejectedValue(Object.assign(new Error('none'), { code: 'auth/user-not-found' }))
  mocks.updateUser.mockResolvedValue({})
  mocks.send.mockResolvedValue({ error: null })
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

  it('leaves nothing pending when the code cannot be delivered', async () => {
    vi.spyOn(devProvider, 'send').mockRejectedValueOnce(new OtpDeliveryError('whatsapp', '131026', 'undeliverable'))
    const res = await changePhone(post({ phone: '+12025550123' }))
    expect(res.status).toBe(502)
    expect((await res.json()).reason).toBe('delivery')
    expect(mocks.store.read(`users/${UID}`)?.pendingPhone).toBeUndefined()
    expect(mocks.store.read(`phoneVerifications/${UID}`)).toBeUndefined()
  })
})

describe('/api/account/verify-phone-otp', () => {
  it('moves the verified number into phone and clears the pending change', async () => {
    await changePhone(post({ phone: '+447911123456' }))
    const res = await verifyPhoneOtp(post({ code: lastLoggedCode() }))
    expect(await res.json()).toEqual({ ok: true, phone: '+447911123456' })
    const user = mocks.store.read(`users/${UID}`)!
    expect(user.phone).toBe('+447911123456')
    expect(user).not.toHaveProperty('pendingPhone')
    expect(user).not.toHaveProperty('pendingPhoneRequestedAt')
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

describe('/api/account/change-email', () => {
  it('stores only the token hash, marks the address pending and mails the link to the new inbox', async () => {
    const res = await changeEmail(post({ newEmail: '  New@Landly.test ', lang: 'he' }))
    expect(await res.json()).toEqual({ ok: true, pendingEmail: 'new@landly.test' })
    expect(mocks.store.read(`users/${UID}`)).toMatchObject({ email: 'old@landly.test', pendingEmail: 'new@landly.test' })
    expect(mocks.updateUser).not.toHaveBeenCalled()

    const sent = mocks.send.mock.calls[0][0]
    expect(sent.to).toBe('new@landly.test')
    expect(sent.subject).toBe(translations.he.emailChange_subject)
    const token = sent.html.match(/confirm-email-change\?token=([A-Za-z0-9_-]{43})/)?.[1]
    expect(token).toBeTruthy()
    const request = mocks.store.read(`emailChangeRequests/${UID}`)!
    expect(request.tokenHash).toBe(hashEmailChangeToken(token))
    expect(JSON.stringify(request)).not.toContain(token)
    expect(JSON.stringify(mocks.store.read(`users/${UID}`))).not.toContain(token)
  })

  it('needs a recent password sign-in, a password account and a free, different address', async () => {
    mocks.token.mockResolvedValueOnce({ uid: UID, auth_time: nowSeconds() - 3600, firebase: {} })
    expect((await (await changeEmail(post({ newEmail: 'new@landly.test' }))).json()).reason).toBe('reauthRequired')

    mocks.getUser.mockResolvedValueOnce({ email: 'old@landly.test', providerData: [{ providerId: 'google.com' }] })
    expect((await (await changeEmail(post({ newEmail: 'new@landly.test' }))).json()).reason).toBe('notPasswordAccount')

    expect((await (await changeEmail(post({ newEmail: 'OLD@landly.test' }))).json()).reason).toBe('sameEmail')
    expect((await (await changeEmail(post({ newEmail: 'not-an-email' }))).json()).reason).toBe('invalidEmail')

    mocks.getUserByEmail.mockResolvedValueOnce({ uid: 'someone-else' })
    expect((await (await changeEmail(post({ newEmail: 'taken@landly.test' }))).json()).reason).toBe('emailInUse')
    expect(mocks.send).not.toHaveBeenCalled()
  })

  it('resends to the pending address without the password, at most once a minute', async () => {
    await changeEmail(post({ newEmail: 'new@landly.test' }))
    mocks.token.mockResolvedValue({ uid: UID, auth_time: nowSeconds() - 3600, firebase: {} })
    const tooSoon = await changeEmail(post({ resend: true }))
    expect(tooSoon.status).toBe(429)
    mocks.store.seed(`emailChangeRequests/${UID}`, { ...mocks.store.read(`emailChangeRequests/${UID}`), lastSentAt: Timestamp.fromMillis(Date.now() - 61_000) })
    const res = await changeEmail(post({ resend: true }))
    expect(await res.json()).toEqual({ ok: true, pendingEmail: 'new@landly.test' })
    expect(mocks.send).toHaveBeenCalledTimes(2)
    expect(mocks.send.mock.calls[1][0].to).toBe('new@landly.test')
  })
})

describe('/api/account/verify-email-change', () => {
  async function startChange() {
    await changeEmail(post({ newEmail: 'new@landly.test', lang: 'fr' }))
    return mocks.send.mock.calls.at(-1)![0].html.match(/token=([A-Za-z0-9_-]{43})/)[1] as string
  }
  const confirm = (token: string) => verifyEmailChange(new Request('https://landly.test/api', { method: 'POST', body: JSON.stringify({ token }) }))

  it('applies the change in Auth and Firestore once, then alerts the previous address', async () => {
    const token = await startChange()
    const res = await confirm(token)
    expect(await res.json()).toEqual({ ok: true })
    expect(mocks.updateUser).toHaveBeenCalledWith(UID, { email: 'new@landly.test', emailVerified: true })
    const user = mocks.store.read(`users/${UID}`)!
    expect(user.email).toBe('new@landly.test')
    expect(user).not.toHaveProperty('pendingEmail')
    expect(mocks.store.read(`emailChangeRequests/${UID}`)).toBeUndefined()

    const alert = mocks.send.mock.calls.at(-1)![0]
    expect(alert.to).toBe('old@landly.test')
    expect(alert.subject).toBe(translations.fr.emailChanged_subject)
    expect(alert.html).toContain('new@landly.test')

    const again = await confirm(token)
    expect(again.status).toBe(410)
  })

  it('refuses unknown, malformed and expired links', async () => {
    expect((await confirm(createEmailChangeToken().token)).status).toBe(410)
    expect((await confirm('short')).status).toBe(400)
    const token = await startChange()
    mocks.store.seed(`emailChangeRequests/${UID}`, { ...mocks.store.read(`emailChangeRequests/${UID}`), expiresAt: Timestamp.fromMillis(Date.now() - 1) })
    const res = await confirm(token)
    expect((await res.json()).reason).toBe('expired')
    expect(mocks.updateUser).not.toHaveBeenCalled()
    expect(mocks.store.read(`users/${UID}`)?.pendingEmail).toBeUndefined()
  })

  it('drops the change when the address was taken meanwhile', async () => {
    const token = await startChange()
    mocks.updateUser.mockRejectedValueOnce(Object.assign(new Error('taken'), { code: 'auth/email-already-exists' }))
    const res = await confirm(token)
    expect((await res.json()).reason).toBe('emailInUse')
    expect(mocks.store.read(`users/${UID}`)).toMatchObject({ email: 'old@landly.test' })
    expect(mocks.store.read(`users/${UID}`)?.pendingEmail).toBeUndefined()
  })

  it('keeps the link usable when Auth is briefly unavailable', async () => {
    const token = await startChange()
    mocks.updateUser.mockRejectedValueOnce(Object.assign(new Error('down'), { code: 'auth/internal-error' }))
    expect((await confirm(token)).status).toBe(503)
    expect((await confirm(token)).status).toBe(200)
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

describe('email change token', () => {
  it('is 256 random bits in base64url and stored only as its SHA-256', () => {
    const { token, tokenHash } = createEmailChangeToken()
    expect(isEmailChangeToken(token)).toBe(true)
    expect(tokenHash).toMatch(/^[0-9a-f]{64}$/)
    expect(hashEmailChangeToken(token)).toBe(tokenHash)
    expect(createEmailChangeToken().token).not.toBe(token)
  })

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
    expect(await confirmEmailChange('x')).toEqual({ ok: false, reason: 'offline' })

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('', { status: 429 })))
    expect(await confirmEmailChange('x')).toEqual({ ok: false, reason: 'rateLimited' })
  })

  it('sends the token only to the confirm route, without an Authorization header', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    await confirmEmailChange('abc')
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/account/verify-email-change')
    expect(init.headers).not.toHaveProperty('Authorization')
  })

  it('maps every reason to copy that exists in all languages', () => {
    const reasons = ['rateLimited', 'unauthorized', 'reauthRequired', 'notPasswordAccount', 'invalidEmail', 'sameEmail', 'emailInUse', 'invalidPhone', 'samePhone', 'delivery', 'noPending', 'invalidCode', 'expired', 'tooManyAttempts', 'invalid', 'failed', 'offline'] as const
    for (const lang of Object.keys(translations) as (keyof typeof translations)[]) {
      for (const reason of reasons) expect(translations[lang][contactChangeErrorKey(reason)], `${lang}.${reason}`).toBeTruthy()
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
    }
  })
})

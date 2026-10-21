import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { devProvider, otpProvider, OtpDeliveryError, phoneVerificationMode, productionProvider } from '@/lib/auth/phoneVerification'
import { whatsappLive } from '@/lib/whatsapp/graph'

// The phone-change code's WhatsApp delivery: which provider runs where, the
// renamed on/off flag, the default template, and the English fallback when
// the member's language has no approved copy of the template.

const metaError = (code: number) => new Response(JSON.stringify({ error: { code, message: `meta ${code}` } }), { status: 400 })
const sentLanguages = (fetchMock: ReturnType<typeof vi.fn>) => fetchMock.mock.calls.map(([, init]) => JSON.parse(init.body).template.language.code)

beforeEach(() => {
  vi.stubEnv('WHATSAPP_ACCESS_TOKEN', 'secret')
  vi.stubEnv('WHATSAPP_PHONE_NUMBER_ID', '555')
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})
})
afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('PHONE_VERIFICATION_ENABLED', () => {
  it('turns verification on in production, and wins over the old flag', () => {
    vi.stubEnv('NODE_ENV', 'production')
    expect(phoneVerificationMode()).toBe('direct')
    vi.stubEnv('PHONE_VERIFICATION_ENABLED', 'true')
    expect(phoneVerificationMode()).toBe('otp')
    vi.stubEnv('FIREBASE_PHONE_AUTH_ENABLED', 'false')
    expect(phoneVerificationMode()).toBe('otp')
  })

  it('still honours FIREBASE_PHONE_AUTH_ENABLED when the new flag is unset', () => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('FIREBASE_PHONE_AUTH_ENABLED', 'true')
    expect(phoneVerificationMode()).toBe('otp')
  })

  it('turns verification off in development when set to false', () => {
    vi.stubEnv('PHONE_VERIFICATION_ENABLED', 'false')
    expect(phoneVerificationMode()).toBe('direct')
  })

  it('saves directly in production when the number ID is missing', () => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('PHONE_VERIFICATION_ENABLED', 'true')
    vi.stubEnv('WHATSAPP_PHONE_NUMBER_ID', '')
    expect(phoneVerificationMode()).toBe('direct')
  })
})

describe('otpProvider', () => {
  it('simulates outside production unless WHATSAPP_OTP_LIVE is on', () => {
    expect(otpProvider()).toBe(devProvider)
    vi.stubEnv('WHATSAPP_OTP_LIVE', 'true')
    expect(otpProvider()).toBe(productionProvider)
  })

  it('never goes live without credentials', () => {
    vi.stubEnv('WHATSAPP_OTP_LIVE', 'true')
    vi.stubEnv('WHATSAPP_ACCESS_TOKEN', '')
    expect(whatsappLive()).toBe(false)
    expect(otpProvider()).toBe(devProvider)
  })

  it('sends for real in production', () => {
    vi.stubEnv('NODE_ENV', 'production')
    expect(otpProvider()).toBe(productionProvider)
  })
})

describe('WhatsApp OTP template', () => {
  it('uses landly_otp_code when WHATSAPP_OTP_TEMPLATE is unset', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    await productionProvider.send({ phone: '+972501234567', code: '123456', channel: 'whatsapp', lang: 'he' })
    const body = JSON.parse(fetchMock.mock.calls[0][1].body)
    expect(body).toMatchObject({ to: '972501234567', template: { name: 'landly_otp_code', language: { code: 'he' } } })
  })

  it('retries once in English when the member language has no template (132001)', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(metaError(132001)).mockResolvedValueOnce(new Response('{}', { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    await productionProvider.send({ phone: '+972501234567', code: '123456', channel: 'whatsapp', lang: 'he' })
    expect(sentLanguages(fetchMock)).toEqual(['he', 'en'])
  })

  it('falls back to WHATSAPP_OTP_FALLBACK_LANGUAGE (en_US)', async () => {
    vi.stubEnv('WHATSAPP_OTP_FALLBACK_LANGUAGE', 'en_US')
    const fetchMock = vi.fn().mockResolvedValueOnce(metaError(132001)).mockResolvedValueOnce(new Response('{}', { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    await productionProvider.send({ phone: '+33612345678', code: '123456', channel: 'whatsapp', lang: 'fr' })
    expect(sentLanguages(fetchMock)).toEqual(['fr', 'en_US'])
  })

  it('does not retry an error that another language would not fix', async () => {
    const fetchMock = vi.fn().mockResolvedValue(metaError(131026))
    vi.stubGlobal('fetch', fetchMock)
    await expect(productionProvider.send({ phone: '+79161234567', code: '123456', channel: 'whatsapp', lang: 'ru' })).rejects.toMatchObject({ code: '131026' })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('does not retry when the code was already sent in English', async () => {
    const fetchMock = vi.fn().mockResolvedValue(metaError(132001))
    vi.stubGlobal('fetch', fetchMock)
    await expect(productionProvider.send({ phone: '+12025550123', code: '123456', channel: 'whatsapp', lang: 'en' })).rejects.toBeInstanceOf(OtpDeliveryError)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('reports the fallback failure when English fails too', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(metaError(132001)).mockResolvedValueOnce(metaError(132015))
    vi.stubGlobal('fetch', fetchMock)
    await expect(productionProvider.send({ phone: '+34612345678', code: '123456', channel: 'whatsapp', lang: 'es' })).rejects.toMatchObject({
      channel: 'whatsapp',
      code: '132015',
    })
  })

  it('reports an unreachable Graph API as a network failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('ECONNRESET')))
    await expect(productionProvider.send({ phone: '+12025550123', code: '123456', channel: 'whatsapp', lang: 'en' })).rejects.toMatchObject({ code: 'network' })
  })
})

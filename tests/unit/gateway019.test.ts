import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/usage/recordUsage', () => ({ recordUsage: vi.fn() }))
vi.mock('@/lib/otp/gateway019Contract', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/otp/gateway019Contract')>()),
  SMS_ENDPOINT: 'https://019.test/sms',
  WHATSAPP_ENDPOINT: 'https://019.test/whatsapp',
}))

import { Gateway019Error, gateway019ConfigProblem, gateway019Live, sendVia019Sms, sendVia019WhatsApp } from '@/lib/otp/gateway019'
import { devProvider, gateway019Provider, otpProvider, OtpDeliveryError, phoneVerificationMode } from '@/lib/auth/phoneVerification'

const SECRET = 'hunter2-secret'
const TOKEN = 'tok-abc-123'
const ok = () => new Response('{}', { status: 200 })

function configure(extra: Record<string, string> = {}) {
  vi.stubEnv('SMS_019_USERNAME', 'landly')
  vi.stubEnv('SMS_019_PASSWORD', SECRET)
  vi.stubEnv('SMS_019_SENDER', 'GoLandly')
  for (const [k, v] of Object.entries(extra)) vi.stubEnv(k, v)
}

let log: ReturnType<typeof vi.spyOn>[]
beforeEach(() => {
  log = (['info', 'warn', 'error', 'log'] as const).map((m) => vi.spyOn(console, m).mockImplementation(() => {}))
})
afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

const logged = () => JSON.stringify(log.flatMap((spy) => spy.mock.calls))

describe('provider selection', () => {
  it('simulates without credentials, even when asked to go live', () => {
    vi.stubEnv('OTP_019_LIVE', 'true')
    expect(gateway019ConfigProblem()).toBe('SMS_019_USERNAME is not configured')
    expect(gateway019Live()).toBe(false)
    expect(otpProvider()).toBe(devProvider)
  })

  it('names each missing setting in turn', () => {
    vi.stubEnv('SMS_019_USERNAME', 'landly')
    expect(gateway019ConfigProblem()).toBe('SMS_019_PASSWORD or SMS_019_TOKEN is not configured')
    vi.stubEnv('SMS_019_TOKEN', TOKEN)
    expect(gateway019ConfigProblem()).toBe('SMS_019_SENDER is not configured')
    vi.stubEnv('SMS_019_SENDER', 'GoLandly')
    expect(gateway019ConfigProblem()).toBeNull()
  })

  it('stays simulated outside production until OTP_019_LIVE=true', () => {
    configure()
    expect(otpProvider()).toBe(devProvider)
    vi.stubEnv('OTP_019_LIVE', 'true')
    expect(otpProvider()).toBe(gateway019Provider)
  })

  it('goes live in production with credentials, and never without them', () => {
    vi.stubEnv('NODE_ENV', 'production')
    expect(otpProvider()).toBe(devProvider)
    configure()
    expect(otpProvider()).toBe(gateway019Provider)
  })

  it('saves directly in production when the flag is on but 019 is incomplete', () => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('PHONE_VERIFICATION_ENABLED', 'true')
    expect(phoneVerificationMode()).toBe('direct')
    configure()
    expect(phoneVerificationMode()).toBe('otp')
  })
})

describe('delivery', () => {
  it('routes SMS and WhatsApp to their own endpoints with the code', async () => {
    configure({ OTP_019_LIVE: 'true' })
    const fetchMock = vi.fn().mockImplementation(async () => ok())
    vi.stubGlobal('fetch', fetchMock)
    await gateway019Provider.send({ phone: '+972501234567', code: '111222', channel: 'sms', lang: 'he' })
    await gateway019Provider.send({ phone: '+12025550123', code: '333444', channel: 'whatsapp', lang: 'en' })
    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual(['https://019.test/sms', 'https://019.test/whatsapp'])
    expect(fetchMock.mock.calls[0][1].body).toContain('111222')
    expect(fetchMock.mock.calls[1][1].body).toContain('333444')
    expect(fetchMock.mock.calls[0][1].signal).toBeInstanceOf(AbortSignal)
  })

  it('sends a bearer token when SMS_019_TOKEN is set', async () => {
    configure({ SMS_019_PASSWORD: '', SMS_019_TOKEN: TOKEN })
    const fetchMock = vi.fn().mockResolvedValue(ok())
    vi.stubGlobal('fetch', fetchMock)
    await sendVia019WhatsApp({ phone: '+33612345678', code: '123456', lang: 'fr' })
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe(`Bearer ${TOKEN}`)
  })

  it.each([
    [401, 'auth'],
    [403, 'auth'],
    [400, 'rejected'],
    [422, 'rejected'],
    [500, 'unavailable'],
    [503, 'unavailable'],
  ])('maps HTTP %i to %s', async (status, code) => {
    configure()
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(`{"echo":"${SECRET}"}`, { status })))
    await expect(sendVia019Sms({ phone: '+972501234567', code: '123456', lang: 'en' })).rejects.toMatchObject({ code, name: 'Gateway019Error' })
  })

  it('reports a network failure or timeout without the underlying message', async () => {
    configure()
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error(`ECONNRESET https://019.test/sms Basic ${SECRET}`)))
    const err = await sendVia019Sms({ phone: '+972501234567', code: '123456', lang: 'en' }).catch((e) => e)
    expect(err).toBeInstanceOf(Gateway019Error)
    expect(err.code).toBe('network')
    expect(err.message).not.toContain(SECRET)
    expect(err.message).not.toContain('019.test')
  })

  it('aborts a hung request after 10 seconds', async () => {
    vi.useFakeTimers()
    configure()
    vi.stubGlobal('fetch', vi.fn().mockImplementation((_url, init) => new Promise((_, reject) => init.signal.addEventListener('abort', () => reject(new Error('aborted'))))))
    const pending = sendVia019Sms({ phone: '+972501234567', code: '123456', lang: 'en' }).catch((e) => e)
    await vi.advanceTimersByTimeAsync(10_000)
    expect(await pending).toMatchObject({ code: 'network' })
    vi.useRealTimers()
  })

  it('surfaces a provider failure as an OtpDeliveryError on the right channel', async () => {
    configure()
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('no', { status: 500 })))
    await expect(gateway019Provider.send({ phone: '+972501234567', code: '1', channel: 'sms', lang: 'en' })).rejects.toBeInstanceOf(OtpDeliveryError)
    await expect(gateway019Provider.send({ phone: '+12025550123', code: '1', channel: 'whatsapp', lang: 'en' })).rejects.toMatchObject({ channel: 'whatsapp', code: 'unavailable' })
  })

  it('never writes credentials, the code or the number to a log or an error', async () => {
    configure({ SMS_019_TOKEN: TOKEN })
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(`${SECRET} ${TOKEN}`, { status: 401 })))
    const err = await gateway019Provider.send({ phone: '+972501234567', code: '987654', channel: 'sms', lang: 'en' }).catch((e) => e)
    for (const text of [logged(), String(err.message), String(err.stack)]) {
      expect(text).not.toContain(SECRET)
      expect(text).not.toContain(TOKEN)
      expect(text).not.toContain('987654')
      expect(text).not.toContain('972501234567')
    }
  })

  it('refuses to send when not configured', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    await expect(sendVia019Sms({ phone: '+972501234567', code: '1', lang: 'en' })).rejects.toMatchObject({ code: 'not_configured' })
    expect(fetchMock).not.toHaveBeenCalled()
  })
})

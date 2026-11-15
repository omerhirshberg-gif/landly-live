import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ recordUsage: vi.fn() }))
vi.mock('@/lib/usage/recordUsage', () => ({ recordUsage: mocks.recordUsage }))

import { classifyStatus, israeliLocalNumber, parseAnswer, SMS_ENDPOINT, SMS_TEXT, WHATSAPP_ENDPOINT } from '@/lib/otp/gateway019Contract'
import { Gateway019Error, gateway019ConfigProblem, gateway019Live, sendVia019Sms, sendVia019WhatsApp } from '@/lib/otp/gateway019'
import { devProvider, gateway019Provider, otpProvider, OtpDeliveryError, phoneVerificationMode } from '@/lib/auth/phoneVerification'

const TOKEN = 'tok-abc-123'
const CODE = '494036'
const answer = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status })
const okSms = () => answer({ status: 0, code: CODE, message: `The code is : ${CODE} and is valid for 5 minutes` })
const okWhatsApp = () => answer({ data: { status: 0, code: CODE, message: 'ok' } })

function configure(extra: Record<string, string> = {}) {
  vi.stubEnv('SMS_019_USERNAME', 'landly')
  vi.stubEnv('SMS_019_TOKEN', TOKEN)
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
    expect(gateway019ConfigProblem()).toBe('SMS_019_TOKEN is not configured')
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

describe('contract', () => {
  it('turns +972 numbers into the local form SMS wants', () => {
    expect(israeliLocalNumber('+972522883388')).toBe('0522883388')
    expect(israeliLocalNumber('+972 52-288-3388')).toBe('0522883388')
  })

  it.each([
    [3, 'auth'],
    [10, 'auth'],
    [11, 'auth'],
    [50, 'auth'],
    [4, 'rejected'],
    [8, 'rejected'],
    [9, 'rejected'],
    [515, 'rejected'],
    [6, 'unavailable'],
    [429, 'unavailable'],
    [999, 'unavailable'],
  ])('classifies status %i as %s', (status, kind) => expect(classifyStatus(status)).toBe(kind))

  it('reads the SMS body and the data-wrapped WhatsApp body', () => {
    expect(parseAnswer(JSON.stringify({ status: 0, code: CODE }), 'sms')).toEqual({ ok: true, code: CODE })
    expect(parseAnswer(JSON.stringify({ data: { status: 0, code: 407526 } }), 'whatsapp')).toEqual({ ok: true, code: '407526' })
  })

  it('reads 019\'s WhatsApp refusal without a status (no credits) as a rejected send', () => {
    expect(parseAnswer(JSON.stringify({ data: { success: false, message: 'notEnoughCredits' } }), 'whatsapp')).toEqual({ ok: false, kind: 'rejected', status: null, reason: 'notEnoughCredits' })
    expect(parseAnswer(JSON.stringify({ data: { success: false, message: 'Something odd 123456' } }), 'whatsapp')).toEqual({ ok: false, kind: 'unavailable', status: null, reason: undefined })
  })

  it('treats success without a usable code, or an unreadable body, as a failed send', () => {
    expect(parseAnswer(JSON.stringify({ status: 0 }), 'sms')).toMatchObject({ ok: false, kind: 'unavailable' })
    expect(parseAnswer(JSON.stringify({ status: 0, code: 'abc' }), 'sms')).toMatchObject({ ok: false })
    expect(parseAnswer('<html>', 'sms')).toMatchObject({ ok: false, kind: 'unavailable' })
    expect(parseAnswer('{}', 'whatsapp')).toMatchObject({ ok: false })
  })
})

describe('usage counters through the real adapter', () => {
  const sms = { phone: '+972501234567', channel: 'sms', lang: 'en' } as const
  const whatsapp = { phone: '+12025550123', channel: 'whatsapp', lang: 'en' } as const
  beforeEach(() => mocks.recordUsage.mockClear())

  it('counts an accepted SMS and an accepted WhatsApp code once each', async () => {
    configure()
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(okSms()).mockResolvedValueOnce(okWhatsApp()))
    await gateway019Provider.send(sms)
    await gateway019Provider.send(whatsapp)
    expect(mocks.recordUsage.mock.calls).toEqual([['gateway019.smsOtpSent'], ['gateway019.whatsappOtpSent']])
  })

  it('does NOT count an HTTP 200 whose body status says the send failed', async () => {
    configure()
    vi.stubGlobal('fetch', vi.fn().mockImplementation(async () => answer({ status: 4, message: 'not enough credit' })))
    await expect(gateway019Provider.send(sms)).rejects.toBeInstanceOf(OtpDeliveryError)
    await expect(gateway019Provider.send(whatsapp)).rejects.toBeInstanceOf(OtpDeliveryError)
    expect(mocks.recordUsage).not.toHaveBeenCalled()
  })

  it('does NOT count status 0 without a usable code', async () => {
    configure()
    vi.stubGlobal('fetch', vi.fn().mockImplementation(async () => answer({ status: 0 })))
    await expect(gateway019Provider.send(sms)).rejects.toBeInstanceOf(OtpDeliveryError)
    expect(mocks.recordUsage).not.toHaveBeenCalled()
  })
})

describe('delivery', () => {
  it('posts the real request shapes to each channel and resolves with 019\'s code', async () => {
    configure({ OTP_019_LIVE: 'true' })
    const fetchMock = vi.fn().mockResolvedValueOnce(okSms()).mockResolvedValueOnce(okWhatsApp())
    vi.stubGlobal('fetch', fetchMock)
    const sms = await gateway019Provider.send({ phone: '+972522883388', channel: 'sms', lang: 'he' })
    const wa = await gateway019Provider.send({ phone: '+12025550123', channel: 'whatsapp', lang: 'he' })
    expect(sms).toEqual({ code: CODE })
    expect(wa).toEqual({ code: CODE })
    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([SMS_ENDPOINT, WHATSAPP_ENDPOINT])
    expect(SMS_ENDPOINT).toBe('https://019sms.co.il/api')
    expect(WHATSAPP_ENDPOINT).toBe('https://019sms.co.il/whatsapp-api/send-otp-whatsapp')
    const [smsCall, waCall] = fetchMock.mock.calls
    expect(smsCall[1].headers.Authorization).toBe(`Bearer ${TOKEN}`)
    expect(waCall[1].headers.Authorization).toBe(`Bearer ${TOKEN}`)
    expect(JSON.parse(smsCall[1].body)).toEqual({
      send_otp: {
        user: { username: 'landly' },
        phone: '0522883388',
        source: 'GoLandly',
        app_id: '1',
        max_tries: '3',
        valid_time: '10',
        text: '[code] is your GoLandly verification code. Valid for 10 minutes.',
      },
    })
    expect(JSON.parse(waCall[1].body)).toEqual({ phone: '12025550123', app_id: '1', max_tries: '3', language: '1' })
    expect(smsCall[1].signal).toBeInstanceOf(AbortSignal)
  })

  it.each(['en', 'he', 'ru', 'fr', 'es'] as const)('sends the same English SMS and the English WhatsApp template when the member uses %s', async (lang) => {
    configure()
    const fetchMock = vi.fn().mockImplementationOnce(async () => okSms()).mockImplementationOnce(async () => okWhatsApp())
    vi.stubGlobal('fetch', fetchMock)
    await gateway019Provider.send({ phone: '+972522883388', channel: 'sms', lang })
    await gateway019Provider.send({ phone: '+33612345678', channel: 'whatsapp', lang })
    const sms = JSON.parse(fetchMock.mock.calls[0][1].body).send_otp
    const wa = JSON.parse(fetchMock.mock.calls[1][1].body)
    expect(sms.text).toBe('[code] is your GoLandly verification code. Valid for 10 minutes.')
    expect(sms.text).toBe(SMS_TEXT)
    expect(wa.language).toBe('1')
  })

  it('never sends a non-English character or 019\'s Hebrew template code, for any language', async () => {
    configure()
    const fetchMock = vi.fn().mockImplementation(async (url: string) => (url === SMS_ENDPOINT ? okSms() : okWhatsApp()))
    vi.stubGlobal('fetch', fetchMock)
    for (const lang of ['he', 'ru', 'fr', 'es'] as const) {
      await gateway019Provider.send({ phone: '+972501234567', channel: 'sms', lang })
      await gateway019Provider.send({ phone: '+12025550123', channel: 'whatsapp', lang })
    }
    for (const [, init] of fetchMock.mock.calls) {
      const body = JSON.parse(init.body)
      const text = body.send_otp?.text
      if (text !== undefined) expect(text).toMatch(/^[\x20-\x7E]+$/)
      if ('language' in body) expect(body.language).not.toBe('2')
    }
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
    vi.stubGlobal('fetch', vi.fn().mockImplementation(async () => new Response(`{"echo":"${TOKEN}"}`, { status })))
    await expect(sendVia019Sms({ phone: '+972501234567' })).rejects.toMatchObject({ code, name: 'Gateway019Error' })
  })

  it.each([
    [4, 'rejected'],
    [12, 'rejected'],
    [3, 'auth'],
    [10, 'auth'],
    [429, 'unavailable'],
  ])('maps an HTTP 200 carrying status %i to %s', async (status, code) => {
    configure()
    vi.stubGlobal('fetch', vi.fn().mockImplementation(async () => answer({ status, message: 'x' })))
    await expect(sendVia019Sms({ phone: '+972501234567' })).rejects.toMatchObject({ code })
    await expect(sendVia019WhatsApp({ phone: '+12025550123' })).rejects.toMatchObject({ code })
  })

  it('answers a WhatsApp send refused for credits as a rejected delivery, uncounted', async () => {
    configure()
    vi.stubGlobal('fetch', vi.fn().mockImplementation(async () => answer({ data: { success: false, message: 'notEnoughCredits' } })))
    mocks.recordUsage.mockClear()
    const err = await gateway019Provider.send({ phone: '+12025550123', channel: 'whatsapp', lang: 'en' }).catch((e) => e)
    expect(err).toBeInstanceOf(OtpDeliveryError)
    expect(err).toMatchObject({ channel: 'whatsapp', code: 'rejected' })
    expect(err.message).toContain('notEnoughCredits')
    expect(mocks.recordUsage).not.toHaveBeenCalled()
  })

  it('reports a network failure or timeout without the underlying message', async () => {
    configure()
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error(`ECONNRESET ${SMS_ENDPOINT} Bearer ${TOKEN}`)))
    const err = await sendVia019Sms({ phone: '+972501234567' }).catch((e) => e)
    expect(err).toBeInstanceOf(Gateway019Error)
    expect(err.code).toBe('network')
    expect(err.message).not.toContain(TOKEN)
    expect(err.message).not.toContain('019sms')
  })

  it('aborts a hung request after 10 seconds', async () => {
    vi.useFakeTimers()
    configure()
    vi.stubGlobal('fetch', vi.fn().mockImplementation((_url, init) => new Promise((_, reject) => init.signal.addEventListener('abort', () => reject(new Error('aborted'))))))
    const pending = sendVia019Sms({ phone: '+972501234567' }).catch((e) => e)
    await vi.advanceTimersByTimeAsync(10_000)
    expect(await pending).toMatchObject({ code: 'network' })
    vi.useRealTimers()
  })

  it('surfaces a provider failure as an OtpDeliveryError on the right channel', async () => {
    configure()
    vi.stubGlobal('fetch', vi.fn().mockImplementation(async () => new Response('no', { status: 500 })))
    await expect(gateway019Provider.send({ phone: '+972501234567', channel: 'sms', lang: 'en' })).rejects.toBeInstanceOf(OtpDeliveryError)
    await expect(gateway019Provider.send({ phone: '+12025550123', channel: 'whatsapp', lang: 'en' })).rejects.toMatchObject({ channel: 'whatsapp', code: 'unavailable' })
  })

  it('never writes credentials, 019\'s code or the number to a log or an error', async () => {
    configure()
    // A refusal that echoes everything back, then an accepted send.
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(answer({ status: 4, code: CODE, echo: TOKEN, phone: '0501234567' })).mockResolvedValueOnce(okSms()))
    const err = await gateway019Provider.send({ phone: '+972501234567', channel: 'sms', lang: 'en' }).catch((e) => e)
    await gateway019Provider.send({ phone: '+972501234567', channel: 'sms', lang: 'en' })
    for (const text of [logged(), String(err.message), String(err.stack)]) {
      expect(text).not.toContain(TOKEN)
      expect(text).not.toContain(CODE)
      expect(text).not.toContain('972501234567')
      expect(text).not.toContain('0501234567')
    }
  })

  it('refuses to send when not configured', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    await expect(sendVia019Sms({ phone: '+972501234567' })).rejects.toMatchObject({ code: 'not_configured' })
    expect(fetchMock).not.toHaveBeenCalled()
  })
})

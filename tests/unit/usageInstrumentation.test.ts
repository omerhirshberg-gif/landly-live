import { createHmac } from 'node:crypto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// Where the API usage counters are fed: each metered call records once it
// succeeds, with the right metric and amount, and never when it fails.

const mocks = vi.hoisted(() => ({
  recordUsage: vi.fn(),
  recordUsageBatch: vi.fn(),
  handleInboundEvents: vi.fn(),
}))
vi.mock('@/lib/usage/recordUsage', () => ({ recordUsage: mocks.recordUsage, recordUsageBatch: mocks.recordUsageBatch }))
vi.mock('@/lib/firebase/admin', () => ({
  getAdminAccessToken: async () => 'access-token',
  getAdminProjectId: () => 'landly-dev',
  getAdminDb: () => {
    throw new Error('not in these tests')
  },
}))
vi.mock('@/lib/whatsapp/supportBotHandler', () => ({ handleInboundEvents: mocks.handleInboundEvents }))
vi.mock('next/server', async (importOriginal) => ({
  ...(await importOriginal<typeof import('next/server')>()),
  after: (task: () => unknown) => void task(),
}))

import { cloudTranslator } from '@/lib/translate/cloudTranslate'
import { autocompleteAddress, placeAddress, reverseGeocodeCity } from '@/lib/maps/googleMaps'
import { sendWhatsAppMessage } from '@/lib/whatsapp/graph'
import { devProvider, productionProvider } from '@/lib/auth/phoneVerification'
import { POST as whatsappWebhook } from '@/app/api/webhooks/whatsapp/route'

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
let fetchMock: ReturnType<typeof vi.fn>

beforeEach(() => {
  fetchMock = vi.fn()
  vi.stubGlobal('fetch', fetchMock)
  vi.stubEnv('GOOGLE_MAPS_SERVER_API_KEY', 'maps-key')
  vi.stubEnv('WHATSAPP_ACCESS_TOKEN', 'wa-token')
  vi.stubEnv('WHATSAPP_PHONE_NUMBER_ID', '1234567890')
  vi.spyOn(console, 'info').mockImplementation(() => {})
  vi.spyOn(console, 'log').mockImplementation(() => {})
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  vi.clearAllMocks()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

describe('Cloud Translation', () => {
  it('counts translated characters as code points, one request per call', async () => {
    fetchMock.mockResolvedValue(json({ translations: [{ translatedText: 'Hello' }, { translatedText: 'Hi 👋' }] }))
    await cloudTranslator.translate(['שלום', 'היי 👋'], 'en', 'he')
    expect(mocks.recordUsageBatch).toHaveBeenCalledWith({ 'google.translation.chars': 4 + 5, 'google.translation.requests': 1 })
  })

  it('counts language detection separately', async () => {
    fetchMock.mockResolvedValue(json({ languages: [{ languageCode: 'he' }] }))
    await cloudTranslator.detect('בדיקה')
    expect(mocks.recordUsageBatch).toHaveBeenCalledWith({ 'google.translation.detectChars': 5, 'google.translation.requests': 1 })
  })

  it('counts nothing when Google refuses the call', async () => {
    fetchMock.mockResolvedValue(json({ error: 'quota' }, 429))
    await expect(cloudTranslator.translate(['שלום'], 'en', 'he')).rejects.toThrow('429')
    expect(mocks.recordUsageBatch).not.toHaveBeenCalled()
  })
})

describe('Google Maps', () => {
  it('counts each autocomplete request', async () => {
    fetchMock.mockResolvedValue(json({ suggestions: [] }))
    await autocompleteAddress('Dizengoff', 'session-token-1234567890', 'en')
    expect(mocks.recordUsage).toHaveBeenCalledExactlyOnceWith('google.places.autocompleteRequests')
  })

  it('counts one Details lookup per language, and the session the first one ends', async () => {
    fetchMock.mockImplementation(async () => json({ id: 'place', formattedAddress: 'Dizengoff 50', location: { latitude: 32.07, longitude: 34.77 } }))
    await placeAddress('place', 'session-token-1234567890')
    const calls = mocks.recordUsageBatch.mock.calls.map(([entries]) => entries)
    expect(calls).toHaveLength(fetchMock.mock.calls.length)
    expect(calls.every((entries) => entries['google.places.detailsRequests'] === 1)).toBe(true)
    expect(calls.filter((entries) => entries['google.places.sessionsCompleted'] === 1)).toHaveLength(1)
  })

  it('counts nothing when a lookup fails', async () => {
    fetchMock.mockResolvedValue(json({ error: 'denied' }, 403))
    await expect(autocompleteAddress('Dizengoff', 'session-token-1234567890', 'he')).rejects.toThrow()
    expect(mocks.recordUsage).not.toHaveBeenCalled()
  })

  it('counts geocoding answers, with or without a city, but not errors', async () => {
    fetchMock.mockResolvedValueOnce(json({ status: 'ZERO_RESULTS' }))
    await reverseGeocodeCity({ lat: 32.07, lng: 34.77 }, 'en')
    fetchMock.mockResolvedValueOnce(json({ status: 'REQUEST_DENIED' }))
    await expect(reverseGeocodeCity({ lat: 32.07, lng: 34.77 }, 'en')).rejects.toThrow()
    expect(mocks.recordUsage.mock.calls).toEqual([['google.geocoding.requests']])
  })
})

describe('WhatsApp', () => {
  const accepted = () => json({ messages: [{ id: 'wamid.ok' }] })

  it('counts an accepted support reply as a free service message', async () => {
    fetchMock.mockResolvedValue(accepted())
    await sendWhatsAppMessage('972501234567', { type: 'text', text: { body: 'Hi' } })
    expect(mocks.recordUsage).toHaveBeenCalledExactlyOnceWith('whatsapp.serviceSent')
  })

  it('counts nothing when Meta refuses a reply', async () => {
    fetchMock.mockResolvedValue(json({ error: { code: 131047, message: 'Re-engagement message' } }, 400))
    await expect(sendWhatsAppMessage('972501234567', { type: 'text', text: { body: 'Hi' } })).rejects.toThrow()
    expect(mocks.recordUsage).not.toHaveBeenCalled()
  })

  it('counts an OTP once Meta accepts it, after a missing-language retry, and never as a service message', async () => {
    fetchMock
      .mockResolvedValueOnce(json({ error: { code: 132001, message: 'Template name does not exist in the translation' } }, 404))
      .mockResolvedValueOnce(accepted())
    await productionProvider.send({ phone: '+972501234567', code: '123456', channel: 'whatsapp', lang: 'he' })
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(mocks.recordUsage.mock.calls).toEqual([['whatsapp.authSent']])
  })

  it('does not count an OTP Meta answered without a wamid', async () => {
    fetchMock.mockResolvedValue(json({}))
    await productionProvider.send({ phone: '+972501234567', code: '123456', channel: 'whatsapp', lang: 'en' })
    expect(mocks.recordUsage).not.toHaveBeenCalled()
  })

  it('counts a simulated OTP at no cost', async () => {
    await devProvider.send({ phone: '+972501234567', code: '123456', channel: 'whatsapp', lang: 'en' })
    expect(mocks.recordUsage).toHaveBeenCalledExactlyOnceWith('whatsapp.simulated')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('counts the message events of a signed webhook delivery', async () => {
    vi.stubEnv('WHATSAPP_APP_SECRET', 'app-secret')
    const message = (id: string) => ({ from: '972501234567', id, timestamp: '1761400000', type: 'text', text: { body: 'היי' } })
    const body = JSON.stringify({
      object: 'whatsapp_business_account',
      entry: [{ changes: [{ field: 'messages', value: { metadata: { phone_number_id: '1234567890' }, contacts: [{ wa_id: '972501234567' }], messages: [message('wamid.1'), message('wamid.2')] } }] }],
    })
    const signature = `sha256=${createHmac('sha256', 'app-secret').update(body).digest('hex')}`
    const res = await whatsappWebhook(new Request('https://landly.test/api/webhooks/whatsapp', { method: 'POST', headers: { 'x-hub-signature-256': signature }, body }))
    expect(res.status).toBe(200)
    expect(mocks.recordUsage).toHaveBeenCalledWith('whatsapp.inboundMessages', 2)
  })
})

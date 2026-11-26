import { createHmac } from 'node:crypto'
import { describe, expect, it, vi } from 'vitest'
import { tranzilaApiHeaders } from '@/lib/payments/tranzilaApiAuth'
import { requestHandshake } from '@/lib/payments/tranzilaHandshake'
import type { TranzilaLiveConfig } from '@/lib/payments/tranzilaConfig'

const config: TranzilaLiveConfig = {
  terminal: 'landly', appKey: 'app-key', apiSecret: 'api-secret', webhookSecret: 'w',
  handshakeUrl: 'https://api.tranzila.com/v2/handshake/create', responseHashSecret: null,
  verifier: 'failclosed',
  orderRefField: null,
  reportsUrl: 'https://report.tranzila.com',
  wallets: { applePay: false, googlePay: false },
}
const req = { terminal: 'landly', amountAgorot: 1025, orderId: 'user_offer' }
const reply = (body: unknown, status = 200) => vi.fn(async () => new Response(JSON.stringify(body), { status }))

describe('tranzilaApiHeaders', () => {
  it('signs the app key with secret + time + nonce (HMAC-SHA256, lowercase hex)', () => {
    const h = tranzilaApiHeaders('app-key', 'api-secret', 1700000000, 'abc')
    expect(h['X-tranzila-api-access-token']).toBe(createHmac('sha256', 'api-secret1700000000abc').update('app-key').digest('hex'))
    expect(h['X-tranzila-api-request-time']).toBe('1700000000')
    expect(h['X-tranzila-api-app-key']).toBe('app-key')
  })
  it('uses a fresh 80-character nonce each call and never exposes the secret', () => {
    const a = tranzilaApiHeaders('k', 's'), b = tranzilaApiHeaders('k', 's')
    expect(a['X-tranzila-api-nonce']).toHaveLength(80)
    expect(a['X-tranzila-api-nonce']).not.toBe(b['X-tranzila-api-nonce'])
    expect(JSON.stringify(a)).not.toContain('"s"')
  })
})

describe('requestHandshake', () => {
  it('binds the frozen amount, terminal and order, and returns the thtk', async () => {
    const fetchImpl = reply({ error_code: 0, message: 'Success', thtk: 'w5129f9cdd2ab53675bbb675c6b59dc51df3b8ce5f' })
    const result = await requestHandshake(req, config, fetchImpl as unknown as typeof fetch)
    expect(result.thtk).toBe('w5129f9cdd2ab53675bbb675c6b59dc51df3b8ce5f')
    expect(result.expiresAtMs).toBeGreaterThan(Date.now() + 18 * 60 * 1000)
    expect(result.expiresAtMs).toBeLessThan(Date.now() + 20 * 60 * 1000)
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe(config.handshakeUrl)
    expect(JSON.parse(init.body as string)).toEqual({ terminal_name: 'landly', sum: 10.25, request_params: { orderId: 'user_offer' } })
    expect((init.headers as Record<string, string>)['X-tranzila-api-access-token']).toMatch(/^[0-9a-f]{64}$/)
  })
  it('fails closed (503) on a refusal, a bad body, HTTP errors or a network error', async () => {
    for (const fetchImpl of [
      reply({ error_code: 400, message: 'bad' }), reply({ error_code: 0 }), reply({ error_code: 0, thtk: 'a b' }),
      reply({ error_code: 0, thtk: 'abcdefgh1234' }, 401), vi.fn(async () => { throw new Error('down') }),
    ]) {
      await expect(requestHandshake(req, config, fetchImpl as unknown as typeof fetch)).rejects.toMatchObject({ status: 503 })
    }
  })
  it('refuses a non-positive amount or a different terminal without calling Tranzila', async () => {
    const fetchImpl = reply({ error_code: 0, thtk: 'abcdefgh1234' })
    await expect(requestHandshake({ ...req, amountAgorot: 0 }, config, fetchImpl as unknown as typeof fetch)).rejects.toMatchObject({ status: 400 })
    await expect(requestHandshake({ ...req, terminal: 'other' }, config, fetchImpl as unknown as typeof fetch)).rejects.toMatchObject({ status: 503 })
    expect(fetchImpl).not.toHaveBeenCalled()
  })
})

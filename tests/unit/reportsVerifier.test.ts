import { describe, expect, it, vi } from 'vitest'
import { createReportsVerifier, ReportsRateGuard, type ReportsClock } from '@/lib/payments/reportsVerifier'
import { assertMatchesExpected } from '@/lib/payments/verifyTranzilaTransaction'
import type { TranzilaLiveConfig } from '@/lib/payments/tranzilaConfig'

const config: TranzilaLiveConfig = {
  terminal: 'landly', appKey: 'app-key', apiSecret: 'api-secret', webhookSecret: 'w', handshakeUrl: 'https://api.tranzila.com/v2/handshake/create',
  responseHashSecret: null, verifier: 'reports', orderRefField: 'order_ref', reportsUrl: 'https://report.tranzila.com',
  wallets: { applePay: false, googlePay: false },
}

// Time and sleep are faked so the limiter is tested without waiting.
function fakeClock(start = Date.parse('2026-11-26T12:00:00Z')): ReportsClock & { t: number } {
  const clock = { t: start, now: () => clock.t, sleep: async (ms: number) => { clock.t += ms } }
  return clock
}
const json = (body: unknown, init: ResponseInit = {}) => new Response(JSON.stringify(body), { status: 200, ...init })
const fields = { fields: [{ field_id: 7, api_parameter_name: 'order_ref' }, { field_id: 3, api_parameter_name: 'contact' }] }
const tx = (over: Record<string, unknown> = {}) => ({
  index: 41711, amount: 10.25, currency: '1', processor_response_code: '000', tranmode: 'A', child_terminal: 'landly', user_defined_7: 'user_offer', ...over,
})

function setup(handler: (path: string, body: Record<string, unknown>) => Response | Promise<Response>) {
  const clock = fakeClock()
  const calls: { path: string; body: Record<string, unknown>; headers: Record<string, string> }[] = []
  const fetchImpl = vi.fn(async (url: string, init: RequestInit) => {
    const path = new URL(url).pathname
    const body = JSON.parse(init.body as string)
    calls.push({ path, body, headers: init.headers as Record<string, string> })
    expect(new URL(url).origin).toBe('https://report.tranzila.com')
    expect(init.redirect).toBe('error')
    return handler(path, body)
  })
  const guard = new ReportsRateGuard(clock)
  const verifier = createReportsVerifier(config, { fetchImpl: fetchImpl as unknown as typeof fetch, guard, clock })
  return { verifier, calls, clock, guard, fetchImpl }
}
const standard = (txs: unknown[]) => (path: string) => (path.endsWith('/fields/list') ? json(fields) : json({ transactions: txs, total: String(txs.length), rows: txs.length }))

describe('reports verifier: request and auth', () => {
  it('signs every call with the four Tranzila headers and looks a transaction up by index', async () => {
    const { verifier, calls } = setup(standard([tx()]))
    const result = await verifier.byTransactionId('landly', '41711')
    expect(result).toEqual({ terminal: 'landly', tranzilaTxnId: '41711', amountAgorot: 1025, currency: 'ILS', tranmode: 'A', approved: true, responseCode: '000', orderId: 'user_offer' })
    expect(calls.map((c) => c.path)).toEqual(['/v1/terminals/settings/fields/list', '/v1/transaction'])
    expect(calls[1].body).toMatchObject({ terminal_name: 'landly', transaction_index: 41711, detailed: 'N' })
    for (const call of calls) {
      expect(Object.keys(call.headers)).toEqual(expect.arrayContaining(['X-tranzila-api-app-key', 'X-tranzila-api-request-time', 'X-tranzila-api-nonce', 'X-tranzila-api-access-token']))
      expect(call.headers['X-tranzila-api-access-token']).toMatch(/^[0-9a-f]{64}$/)
      expect(call.headers['X-tranzila-api-nonce']).toMatch(/^[0-9a-f]{80}$/)
    }
  })
  it('looks an order up by our reference field in a two-day window and caches the field listing', async () => {
    const { verifier, calls } = setup(standard([tx()]))
    await verifier.byOrderId('landly', 'user_offer')
    await verifier.byOrderId('landly', 'user_offer')
    expect(calls.filter((c) => c.path.endsWith('/fields/list'))).toHaveLength(1)
    expect(calls[1].body).toMatchObject({
      terminal_name: 'landly', transaction_start_date: '2026-11-25', transaction_end_date: '2026-11-27',
      ufields: [{ name: 'order_ref', operator: 'equals', value: 'user_offer' }],
    })
  })
  it('does not call Tranzila for an id that is not an index', async () => {
    const { verifier, fetchImpl } = setup(standard([]))
    expect(await verifier.byTransactionId('landly', 'abc')).toBeNull()
    expect(fetchImpl).not.toHaveBeenCalled()
  })
  it('returns null when Tranzila holds nothing', async () => {
    const { verifier } = setup(standard([]))
    expect(await verifier.byOrderId('landly', 'user_offer')).toBeNull()
    expect(await verifier.byTransactionId('landly', '41711')).toBeNull()
  })
})

describe('reports verifier: what it refuses to settle', () => {
  it('answers 503 when it cannot tie the transaction to an order (no reference on the record, or the field is not configured)', async () => {
    const empty = setup(standard([tx({ user_defined_7: '' })]))
    await expect(empty.verifier.byTransactionId('landly', '41711')).rejects.toMatchObject({ status: 503 })
    const noField = setup((path) => (path.endsWith('/fields/list') ? json({ fields: [{ field_id: 3, api_parameter_name: 'contact' }] }) : json({ transactions: [tx()] })))
    await expect(noField.verifier.byOrderId('landly', 'user_offer')).rejects.toMatchObject({ status: 503 })
    const noRef = createReportsVerifier({ ...config, orderRefField: null }, { fetchImpl: vi.fn() as unknown as typeof fetch })
    await expect(noRef.byOrderId('landly', 'user_offer')).rejects.toMatchObject({ status: 503 })
  })
  it('reconciles instead of settling a record with another currency, mode or terminal, or an amount that differs', async () => {
    for (const bad of [{ currency: '2' }, { tranmode: 'F' }]) {
      const { verifier } = setup(standard([tx(bad)]))
      await expect(verifier.byTransactionId('landly', '41711')).rejects.toMatchObject({ status: 409 })
    }
    const other = setup(standard([tx({ child_terminal: 'other' })]))
    const record = (await other.verifier.byTransactionId('landly', '41711'))!
    expect(() => assertMatchesExpected(record, { orderId: 'user_offer', terminal: 'landly', amountAgorot: 1025 })).toThrow('reconciliation')
    // A different unit of `amount` (say agorot) cannot slip through as the right price.
    const cents = setup(standard([tx({ amount: 1025 })]))
    const wrongUnit = (await cents.verifier.byTransactionId('landly', '41711'))!
    expect(wrongUnit.amountAgorot).toBe(102500)
    expect(() => assertMatchesExpected(wrongUnit, { orderId: 'user_offer', terminal: 'landly', amountAgorot: 1025 })).toThrow('reconciliation')
  })
  it('rejects malformed rows (no index, no response code) as unavailable', async () => {
    await expect(setup(standard([tx({ index: undefined })])).verifier.byOrderId('landly', 'user_offer')).rejects.toMatchObject({ status: 503 })
    await expect(setup(standard([tx({ processor_response_code: 'x' })])).verifier.byTransactionId('landly', '41711')).rejects.toMatchObject({ status: 503 })
  })
  it('re-checks the order id on every returned row, whatever Tranzila filtered', async () => {
    const { verifier } = setup(standard([tx({ user_defined_7: 'someone_else' })]))
    expect(await verifier.byOrderId('landly', 'user_offer')).toBeNull()
  })
  it('picks the approved attempt, else the newest decline, and treats two approvals as a double charge', async () => {
    const decline = tx({ index: 2, processor_response_code: '005' })
    const older = tx({ index: 1, processor_response_code: '004' })
    const approved = tx({ index: 3 })
    expect((await setup(standard([approved, decline, older])).verifier.byOrderId('landly', 'user_offer'))).toMatchObject({ tranzilaTxnId: '3', approved: true })
    expect((await setup(standard([decline, older])).verifier.byOrderId('landly', 'user_offer'))).toMatchObject({ tranzilaTxnId: '2', approved: false, responseCode: '005' })
    await expect(setup(standard([approved, tx({ index: 4 })])).verifier.byOrderId('landly', 'user_offer')).rejects.toMatchObject({ status: 409 })
  })
})

describe('reports verifier: failures and rate limits', () => {
  it('maps a refused or broken response to 503', async () => {
    await expect(setup(() => json({ error_code: 401 }, { status: 401 })).verifier.byOrderId('landly', 'o')).rejects.toMatchObject({ status: 503 })
    await expect(setup(() => new Response('nope', { status: 200 })).verifier.byOrderId('landly', 'o')).rejects.toMatchObject({ status: 503 })
  })
  it('stops calling Tranzila after a 429 (error 20006) until Retry-After plus the documented minute has passed', async () => {
    let blocked = true
    const { verifier, clock, fetchImpl } = setup((path) => {
      if (path.endsWith('/fields/list')) return json(fields)
      return blocked ? json({ error_code: 20006, retry_after_seconds: 30 }, { status: 429, headers: { 'Retry-After': '30' } }) : json({ transactions: [tx()] })
    })
    await expect(verifier.byOrderId('landly', 'user_offer')).rejects.toMatchObject({ status: 503 })
    const sent = fetchImpl.mock.calls.length
    await expect(verifier.byOrderId('landly', 'user_offer')).rejects.toMatchObject({ status: 503 })
    expect(fetchImpl.mock.calls.length).toBe(sent) // nothing went out while blocked
    blocked = false
    clock.t += 30_000 + 60_000 - 1
    await expect(verifier.byOrderId('landly', 'user_offer')).rejects.toMatchObject({ status: 503 })
    clock.t += 2
    expect(await verifier.byOrderId('landly', 'user_offer')).toMatchObject({ tranzilaTxnId: '41711' })
  })
  it('treats a non-JSON failure page as a 429 too', async () => {
    const { verifier, fetchImpl } = setup((path) => (path.endsWith('/fields/list') ? json(fields) : new Response('<html>blocked</html>', { status: 403 })))
    await expect(verifier.byOrderId('landly', 'o')).rejects.toMatchObject({ status: 503 })
    const sent = fetchImpl.mock.calls.length
    await expect(verifier.byOrderId('landly', 'o')).rejects.toMatchObject({ status: 503 })
    expect(fetchImpl.mock.calls.length).toBe(sent)
  })
})

describe('ReportsRateGuard', () => {
  it('spaces requests under 25 per second and 900 per minute, and fails fast instead of waiting long', async () => {
    const clock = fakeClock()
    const guard = new ReportsRateGuard(clock)
    const start = clock.t
    for (let i = 0; i < 25; i++) await guard.acquire()
    expect(clock.t).toBe(start) // the first 25 in a second go straight out
    await guard.acquire() // the 26th waits for the second to pass
    expect(clock.t - start).toBeGreaterThanOrEqual(1000)
    // Fill the minute: 900 requests spread over time, then the next would wait far longer than allowed.
    const g2 = new ReportsRateGuard(fakeClock())
    const c2 = (g2 as unknown as { clock: ReportsClock & { t: number } }).clock
    for (let i = 0; i < 900; i++) { await g2.acquire(); c2.t += 40 }
    await expect(g2.acquire()).rejects.toMatchObject({ status: 503 })
  })
})

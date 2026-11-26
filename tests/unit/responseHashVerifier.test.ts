import { createHmac } from 'node:crypto'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { TransactionStore } from '../helpers/transactionStore'
import { business, offer, pending, terminal } from '../helpers/paymentFixtures'
import { setResponseHashCanonicalizer, verifiedFromChargeResponse } from '@/lib/payments/responseHashVerifier'
import { settleChargeResponse } from '@/lib/payments/settleVerifiedPayment'
import { setTranzilaVerifier } from '@/lib/payments/verifyTranzilaTransaction'

// The real canonical form is not documented, so the tests use a stand-in registered through the one seam.
const SECRET = 'hash-secret'
const canonical = (body: Record<string, unknown>) => JSON.stringify(body)
const sign = (body: Record<string, unknown>, secret = SECRET) => ({ ...body, response_hash: createHmac('sha256', secret).update(canonical(body)).digest('hex') })
const response = (over: Record<string, unknown> = {}) => sign({
  errors: null,
  transaction_response: {
    success: true, processor_response_code: '000', transaction_id: 41711, amount: 10.25, currency_code: 'ILS', tranmode: 'A',
    user_form_data: { orderId: 'user_offer' }, ...over,
  },
})
const ctx = { orderId: 'user_offer', terminal, secret: SECRET }

beforeEach(() => setResponseHashCanonicalizer(canonical))
afterEach(() => { setResponseHashCanonicalizer(null); setTranzilaVerifier(null) })

it('FAILS CLOSED until Tranzila confirms how the hash is built (no canonical form registered) or without the secret', () => {
  setResponseHashCanonicalizer(null)
  expect(() => verifiedFromChargeResponse(response(), ctx)).toThrow(expect.objectContaining({ status: 503 }))
  setResponseHashCanonicalizer(canonical)
  expect(() => verifiedFromChargeResponse(response(), { ...ctx, secret: null })).toThrow(expect.objectContaining({ status: 503 }))
})
it('verifies a correctly signed response and maps it to the transaction Tranzila describes', () => {
  expect(verifiedFromChargeResponse(response(), ctx)).toEqual({
    terminal, tranzilaTxnId: '41711', amountAgorot: 1025, currency: 'ILS', tranmode: 'A', approved: true, responseCode: '000', orderId: 'user_offer',
  })
  expect(verifiedFromChargeResponse(response({ success: false, processor_response_code: '005' }), ctx)).toMatchObject({ approved: false, responseCode: '005' })
})
it('rejects a tampered or wrongly signed response (409) and one with no hash', () => {
  const tampered = response() as unknown as { transaction_response: Record<string, unknown> }
  tampered.transaction_response.amount = 0.01
  expect(() => verifiedFromChargeResponse(tampered, ctx)).toThrow(expect.objectContaining({ status: 409 }))
  expect(() => verifiedFromChargeResponse(sign({ transaction_response: { success: true } }, 'other-secret'), ctx)).toThrow(expect.objectContaining({ status: 409 }))
  const { response_hash: _unused, ...unsigned } = response() as Record<string, unknown>
  void _unused
  expect(() => verifiedFromChargeResponse(unsigned, ctx)).toThrow(expect.objectContaining({ status: 409 }))
  expect(() => verifiedFromChargeResponse('nope', ctx)).toThrow(expect.objectContaining({ status: 409 }))
})
it('refuses a signed response that carries no order reference, or another currency or mode', () => {
  expect(() => verifiedFromChargeResponse(response({ user_form_data: {} }), ctx)).toThrow(expect.objectContaining({ status: 409 }))
  expect(() => verifiedFromChargeResponse(response({ currency_code: 'USD' }), ctx)).toThrow('reconciliation')
  expect(() => verifiedFromChargeResponse(response({ tranmode: 'V' }), ctx)).toThrow('reconciliation')
})

// ---- through settlement ----
let store: TransactionStore
beforeEach(() => {
  vi.stubEnv('TRANZILA_TERMINAL', terminal)
  store = new TransactionStore()
  store.seed('orders/user_offer', pending)
  store.seed('offers/offer', offer)
  store.seed('businesses/business', business)
})
afterEach(() => vi.unstubAllEnvs())

it('settles a verified approval once, converging on replay', async () => {
  const first = await settleChargeResponse(store.db, 'user_offer', response(), SECRET)
  expect(first).toMatchObject({ status: 'paid', alreadyProcessed: false })
  expect(store.read('orders/user_offer')?.status).toBe('paid')
  expect((await settleChargeResponse(store.db, 'user_offer', response(), SECRET)).alreadyProcessed).toBe(true)
  expect(store.count('vouchers')).toBe(1)
})
it('keeps a verified decline retryable', async () => {
  const result = await settleChargeResponse(store.db, 'user_offer', response({ success: false, processor_response_code: '005' }), SECRET)
  expect(result.status).toBe('declined')
  expect(store.read('orders/user_offer')?.status).toBe('pending')
})
it('settles nothing for another order\'s response, a different amount, or a bad signature', async () => {
  const before = store.snapshot()
  await expect(settleChargeResponse(store.db, 'user_offer', response({ user_form_data: { orderId: 'other_order' } }), SECRET)).rejects.toThrow('reconciliation')
  await expect(settleChargeResponse(store.db, 'user_offer', response({ amount: 1 }), SECRET)).rejects.toThrow('reconciliation')
  await expect(settleChargeResponse(store.db, 'user_offer', response(), 'wrong-secret')).rejects.toMatchObject({ status: 409 })
  expect(store.snapshot()).toEqual(before)
})

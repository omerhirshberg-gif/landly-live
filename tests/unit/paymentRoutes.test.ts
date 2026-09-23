import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { TransactionStore } from '../helpers/transactionStore'
import { business, event, notification, offer, pending, terminal } from '../helpers/paymentFixtures'

const mocks = vi.hoisted(() => {
  class MockRequestAuthError extends Error { status: 401 | 403 | 503; constructor(message: string, status: 401 | 403 | 503) { super(message); this.status = status } }
  return { getDb: vi.fn(), verifiedUid: vi.fn(), MockRequestAuthError }
})
vi.mock('@/lib/firebase/admin', () => ({ getAdminDb: mocks.getDb }))
vi.mock('@/lib/firebase/verifyRequestUser', () => ({ requireVerifiedCustomerUid: mocks.verifiedUid, RequestAuthError: mocks.MockRequestAuthError }))
import { POST as callback } from '@/app/api/payments/tranzila-webhook/route'
import { POST as initiate } from '@/app/api/payments/initiate/route'

let store: TransactionStore
beforeEach(() => {
  vi.clearAllMocks()
  vi.stubEnv('TRANZILA_WEBHOOK_SECRET', 'test-secret')
  vi.stubEnv('TRANZILA_TERMINAL', terminal)
  store = new TransactionStore()
  store.seed('orders/user_offer', pending)
  store.seed('offers/offer', offer)
  store.seed('businesses/business', business)
  mocks.getDb.mockReturnValue(store.db)
  mocks.verifiedUid.mockResolvedValue('user')
  vi.spyOn(console, 'error').mockImplementation(() => {})
})
afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks() })

it('authenticates before any database access', async () => {
  const req = notification()
  req.headers.delete('x-tranzila-webhook-secret')
  expect((await callback(req)).status).toBe(401)
  expect(mocks.getDb).not.toHaveBeenCalled()
})
it('rejects malformed notifications without accessing the database', async () => {
  expect((await callback(notification({ Response: 'false' }))).status).toBe(400)
  expect(mocks.getDb).not.toHaveBeenCalled()
})
it('acknowledges success and retries with plain OK', async () => {
  expect(await (await callback(notification())).text()).toBe('OK')
  const before = store.snapshot()
  expect(await (await callback(notification())).text()).toBe('OK')
  expect(store.snapshot()).toEqual(before)
})
it('returns 503 on commit failure and successfully processes a retry', async () => {
  const before = store.snapshot()
  store.beforeCommit = async () => { throw new Error('unavailable') }
  expect((await callback(notification())).status).toBe(503)
  expect(store.snapshot()).toEqual(before)
  expect((await callback(notification())).status).toBe(200)
  expect(store.read(`orders/${event.orderId}`)?.status).toBe('paid')
})
it('returns a reconciliation conflict for mismatched payment details', async () => {
  expect((await callback(notification({ sum: '9.99' }))).status).toBe(409)
  expect(store.count('vouchers')).toBe(0)
})
it('requires authentication for initiation', async () => {
  mocks.verifiedUid.mockRejectedValue(new mocks.MockRequestAuthError('Unauthorized', 401))
  expect((await initiate(new Request('https://test.invalid', { method: 'POST' }))).status).toBe(401)
  expect(mocks.getDb).not.toHaveBeenCalled()
})
it('returns the unchanged pending order on initiation and rejects after settlement', async () => {
  const request = () => new Request('https://test.invalid', { method: 'POST', body: JSON.stringify({ offerId: 'offer' }) })
  const before = store.snapshot()
  expect((await initiate(request())).status).toBe(200)
  expect(store.snapshot()).toEqual(before)
  await callback(notification())
  expect((await initiate(request())).status).toBe(409)
})

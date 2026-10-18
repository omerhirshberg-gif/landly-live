import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { TransactionStore } from '../helpers/transactionStore'
import { business, offer, pending } from '../helpers/paymentFixtures'

const mocks = vi.hoisted(() => {
  class MockRequestAuthError extends Error { status: 401 | 403 | 503; constructor(message: string, status: 401 | 403 | 503) { super(message); this.status = status } }
  return { getDb: vi.fn(), verifiedUid: vi.fn(), scheduleConfirmation: vi.fn(), MockRequestAuthError }
})
vi.mock('@/lib/firebase/admin', () => ({ getAdminDb: mocks.getDb }))
vi.mock('@/lib/payments/orderConfirmation', () => ({ scheduleOrderConfirmation: mocks.scheduleConfirmation }))
// Far more calls than the per-minute payment budget; the limiter has its own tests.
vi.mock('@/lib/auth/uidRateLimit', () => ({ checkUidRateLimit: () => null }))
vi.mock('@/lib/firebase/verifyRequestUser', () => ({ requireVerifiedCustomerUid: mocks.verifiedUid, RequestAuthError: mocks.MockRequestAuthError }))
import { POST as sandbox } from '@/app/api/payments/dev-sandbox/route'
import { POST as initiate } from '@/app/api/payments/initiate/route'
import { DEV_SANDBOX_TERMINAL, isPaymentSandboxEnabled } from '@/lib/payments/devSandbox'
import { checkoutTerminal } from '@/lib/payments/paymentValidation'

const sandboxOrder = { ...pending, terminal: DEV_SANDBOX_TERMINAL, validityDays: 30, redemptionTerms: 'Frozen terms' }
const settle = (outcome: string, orderId = 'user_offer') =>
  sandbox(new Request('https://test.invalid', { method: 'POST', body: JSON.stringify({ orderId, outcome }) }))

let store: TransactionStore
beforeEach(() => {
  vi.clearAllMocks()
  vi.stubEnv('NODE_ENV', 'development')
  vi.stubEnv('LANDLY_VERCEL', '')
  vi.stubEnv('LANDLY_VERCEL_ENV', '')
  vi.stubEnv('TRANZILA_TERMINAL', '')
  store = new TransactionStore()
  store.seed('offers/offer', { ...offer, redemptionTerms: 'Edited after checkout' })
  store.seed('businesses/business', business)
  mocks.getDb.mockReturnValue(store.db)
  mocks.verifiedUid.mockResolvedValue('user')
  vi.spyOn(console, 'error').mockImplementation(() => {})
})
afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks() })

describe('sandbox gate', () => {
  it('is on for local next dev without a terminal', () => {
    expect(isPaymentSandboxEnabled()).toBe(true)
    expect(checkoutTerminal()).toBe(DEV_SANDBOX_TERMINAL)
  })
  it('is off in a production build', () => {
    vi.stubEnv('NODE_ENV', 'production')
    expect(isPaymentSandboxEnabled()).toBe(false)
    expect(() => checkoutTerminal()).toThrow('Payment terminal is not configured.')
  })
  it.each(['production', 'preview'])('is off on Vercel %s', (env) => {
    vi.stubEnv('LANDLY_VERCEL', '1')
    vi.stubEnv('LANDLY_VERCEL_ENV', env)
    expect(isPaymentSandboxEnabled()).toBe(false)
    expect(() => checkoutTerminal()).toThrow('Payment terminal is not configured.')
  })
  it('steps aside once a real terminal is configured', () => {
    vi.stubEnv('TRANZILA_TERMINAL', 'landly_real')
    expect(isPaymentSandboxEnabled()).toBe(false)
    expect(checkoutTerminal()).toBe('landly_real')
  })
})

describe('initiation', () => {
  const request = () => new Request('https://test.invalid', { method: 'POST', body: JSON.stringify({ offerId: 'offer' }) })
  it('creates a sandbox order locally', async () => {
    const res = await initiate(request())
    expect(res.status).toBe(200)
    expect((await res.json()).sandbox).toBe(true)
    expect(store.read('orders/user_offer')?.terminal).toBe(DEV_SANDBOX_TERMINAL)
  })
  it('still refuses without a terminal in production', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    expect((await initiate(request())).status).toBe(503)
    expect(store.count('orders')).toBe(0)
  })
})

describe('stale sandbox orders', () => {
  const request = (extra: Record<string, unknown> = {}) =>
    new Request('https://test.invalid', { method: 'POST', body: JSON.stringify({ offerId: 'offer', ...extra }) })

  it('replaces a pending order from an older sandbox terminal instead of returning 409', async () => {
    store.seed('orders/user_offer', { ...sandboxOrder, terminal: 'landly-dev-sandbox' })
    const res = await initiate(request())
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ sandbox: true, resumed: false })
    expect(store.read('orders/user_offer')).toMatchObject({ status: 'pending', terminal: DEV_SANDBOX_TERMINAL, redemptionTerms: 'Edited after checkout' })
    expect(store.count('supersededOrders')).toBe(1)
    const [archived] = Object.entries(store.snapshot()).filter(([path]) => path.startsWith('supersededOrders/'))
    expect(archived[1]).toMatchObject({ orderId: 'user_offer', status: 'superseded', previousStatus: 'pending', terminal: 'landly-dev-sandbox' })
  })
  it('lets a declined test payment be retried', async () => {
    store.seed('orders/user_offer', sandboxOrder)
    await settle('decline')
    expect((await initiate(request())).status).toBe(200)
    expect(store.read('orders/user_offer')?.status).toBe('pending')
    expect((await settle('approve')).status).toBe(200)
    expect(store.read('vouchers/user_offer')?.status).toBe('active')
  })
  it('resumes an unfinished sandbox order unchanged', async () => {
    store.seed('orders/user_offer', sandboxOrder)
    const before = store.snapshot()
    const res = await initiate(request())
    expect(await res.json()).toMatchObject({ sandbox: true, resumed: true, redemptionTerms: 'Frozen terms' })
    expect(store.snapshot()).toEqual(before)
  })
  it('archives an unfinished order and opens a fresh one on restart', async () => {
    store.seed('orders/user_offer', { ...sandboxOrder, termsAcceptedAt: pending.createdAt })
    const res = await initiate(request({ restart: true }))
    expect(await res.json()).toMatchObject({ resumed: false, termsAccepted: false, redemptionTerms: 'Edited after checkout' })
    expect(store.read('orders/user_offer')?.termsAcceptedAt).toBeNull()
    expect(store.count('supersededOrders')).toBe(1)
  })
  it('never replaces a paid order', async () => {
    store.seed('orders/user_offer', sandboxOrder)
    await settle('approve')
    const before = store.snapshot()
    expect((await initiate(request({ restart: true }))).status).toBe(409)
    expect(store.snapshot()).toEqual(before)
  })
  it('keeps the strict 409 outside the sandbox, restart or not', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('TRANZILA_TERMINAL', 'landly_real')
    store.seed('orders/user_offer', { ...pending, status: 'failed' })
    const before = store.snapshot()
    expect((await initiate(request())).status).toBe(409)
    expect((await initiate(request({ restart: true }))).status).toBe(409)
    expect(store.snapshot()).toEqual(before)
    expect(store.count('supersededOrders')).toBe(0)
  })
})

describe('sandbox settlement route', () => {
  beforeEach(() => store.seed('orders/user_offer', sandboxOrder))

  it('does not exist outside local development', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    expect((await settle('approve')).status).toBe(404)
    expect(mocks.verifiedUid).not.toHaveBeenCalled()
    expect(mocks.getDb).not.toHaveBeenCalled()
  })
  it('issues the voucher with the terms frozen on the order', async () => {
    expect((await settle('approve')).status).toBe(200)
    const order = store.read('orders/user_offer')
    expect(order?.status).toBe('paid')
    expect(order?.voucherId).toBe('user_offer')
    const voucher = store.read('vouchers/user_offer')
    expect(voucher?.status).toBe('active')
    expect(voucher?.redemptionTerms).toBe('Frozen terms')
    expect(store.read('offers/offer')?.claimedCount).toBe(1)
    expect(store.count('paymentTransactions')).toBe(1)
    expect(mocks.scheduleConfirmation).toHaveBeenCalledExactlyOnceWith(store.db, 'user_offer')
  })
  it('marks a declined payment failed without a voucher', async () => {
    expect((await settle('decline')).status).toBe(200)
    expect(store.read('orders/user_offer')?.status).toBe('failed')
    expect(store.count('vouchers')).toBe(0)
    expect(mocks.scheduleConfirmation).not.toHaveBeenCalled()
  })
  it('changes nothing on a repeat call', async () => {
    await settle('approve')
    const before = store.snapshot()
    expect((await settle('approve')).status).toBe(409)
    expect(store.snapshot()).toEqual(before)
    expect(mocks.scheduleConfirmation).toHaveBeenCalledTimes(1)
  })
  it("refuses another member's order", async () => {
    mocks.verifiedUid.mockResolvedValue('someone-else')
    expect((await settle('approve')).status).toBe(404)
    expect(store.count('vouchers')).toBe(0)
  })
  it('refuses an order placed on a real terminal', async () => {
    store.seed('orders/user_offer', { ...sandboxOrder, terminal: 'landly_real' })
    expect((await settle('approve')).status).toBe(409)
    expect(store.count('vouchers')).toBe(0)
  })
  it('rejects an unknown outcome', async () => {
    expect((await settle('refund')).status).toBe(400)
  })
})

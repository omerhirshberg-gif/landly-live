import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { TransactionStore } from '../helpers/transactionStore'
import { business, form, offer, pending, terminal } from '../helpers/paymentFixtures'
import { stubLiveTranzila, useFakeVerifier, verifiedTx } from '../helpers/tranzilaLive'
import { signNotifyToken, verifyNotifyToken } from '@/lib/payments/notifyToken'
import { setTranzilaVerifier } from '@/lib/payments/verifyTranzilaTransaction'
import { MAX_HANDSHAKES_PER_ORDER } from '@/lib/payments/handshakeBudget'

const mocks = vi.hoisted(() => {
  class MockRequestAuthError extends Error { status: 401 | 403 | 503; constructor(message: string, status: 401 | 403 | 503) { super(message); this.status = status } }
  return { getDb: vi.fn(), verifiedUid: vi.fn(), scheduleConfirmation: vi.fn(), MockRequestAuthError }
})
vi.mock('@/lib/firebase/admin', () => ({ getAdminDb: mocks.getDb }))
// The per-member request budget has its own tests (securityLimits); here the per-order handshake cap is under test.
vi.mock('@/lib/auth/uidRateLimit', () => ({ checkUidRateLimit: async () => null }))
vi.mock('@/lib/auth/durableRateLimit.server', () => ({ isDurablyLimited: async () => false }))
vi.mock('@/lib/payments/orderConfirmation', () => ({ scheduleOrderConfirmation: mocks.scheduleConfirmation }))
vi.mock('@/lib/firebase/verifyRequestUser', () => ({ requireVerifiedCustomerUid: mocks.verifiedUid, RequestAuthError: mocks.MockRequestAuthError }))
import { POST as webhook } from '@/app/api/payments/tranzila-webhook/route'
import { POST as initiate } from '@/app/api/payments/initiate/route'
import { POST as confirm } from '@/app/api/payments/confirm/route'

const claims = { orderId: 'user_offer', terminal, amountAgorot: 1025 }
const token = () => signNotifyToken(claims, 'test-secret')
const notify = (query: string, fields: Record<string, string> = form, headers: Record<string, string> = {}) =>
  new Request(`https://landly.test/api/payments/tranzila-webhook${query}`, {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', ...headers }, body: new URLSearchParams(fields),
  })
const authed = (path: string, body: unknown) => new Request(`https://landly.test${path}`, { method: 'POST', body: JSON.stringify(body) })

let store: TransactionStore
let tranzila: ReturnType<typeof useFakeVerifier>
beforeEach(() => {
  vi.clearAllMocks()
  stubLiveTranzila()
  tranzila = useFakeVerifier()
  store = new TransactionStore()
  store.seed('orders/user_offer', pending)
  store.seed('offers/offer', offer)
  store.seed('businesses/business', business)
  mocks.getDb.mockReturnValue(store.db)
  mocks.verifiedUid.mockResolvedValue('user')
  vi.spyOn(console, 'error').mockImplementation(() => {})
})
afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); vi.unstubAllGlobals(); setTranzilaVerifier(null) })

// ---- webhook gate and R2 ----
it('rejects a notification with neither the signed token nor the header, before any database access', async () => {
  expect((await webhook(notify(''))).status).toBe(401)
  expect(mocks.getDb).not.toHaveBeenCalled()
})
it('rejects a token signed for another amount or order, before any database access', async () => {
  const forged = signNotifyToken({ ...claims, amountAgorot: 1 }, 'test-secret')
  expect((await webhook(notify(`?o=user_offer&t=${forged}`))).status).toBe(401)
  expect((await webhook(notify('?o=user_offer&t=' + 'a'.repeat(64)))).status).toBe(401)
  expect(mocks.getDb).not.toHaveBeenCalled()
})
it('settles a signed notification only after Tranzila confirms the transaction', async () => {
  expect(await (await webhook(notify(`?o=user_offer&t=${token()}`))).text()).toBe('OK')
  expect(store.read('orders/user_offer')?.status).toBe('paid')
  expect(mocks.scheduleConfirmation).toHaveBeenCalledOnce()
  // A retry replays without a second voucher or email.
  expect((await webhook(notify(`?o=user_offer&t=${token()}`))).status).toBe(200)
  expect(store.count('vouchers')).toBe(1)
  expect(mocks.scheduleConfirmation).toHaveBeenCalledOnce()
})
it('FAILS CLOSED: a forged but correctly signed notification settles nothing while Tranzila does not know the transaction', async () => {
  tranzila.current = null
  const before = store.snapshot()
  expect((await webhook(notify(`?o=user_offer&t=${token()}`))).status).toBe(503)
  expect(store.snapshot()).toEqual(before)
})
it('FAILS CLOSED with the default verifier (lookup not yet confirmed with Tranzila)', async () => {
  setTranzilaVerifier(null)
  const before = store.snapshot()
  expect((await webhook(notify(`?o=user_offer&t=${token()}`))).status).toBe(503)
  expect(store.snapshot()).toEqual(before)
})
it('refuses a notification whose amount differs from Tranzila\'s own record', async () => {
  tranzila.current = { ...verifiedTx, amountAgorot: 999 }
  expect((await webhook(notify(`?o=user_offer&t=${token()}`))).status).toBe(409)
  expect(store.count('vouchers')).toBe(0)
})
it('settles with what Tranzila reports (a decline) even when the notification claims approval', async () => {
  tranzila.current = { ...verifiedTx, approved: false, responseCode: '004' }
  expect((await webhook(notify(`?o=user_offer&t=${token()}`))).status).toBe(200)
  expect(store.read('orders/user_offer')?.status).toBe('failed')
  expect(mocks.scheduleConfirmation).not.toHaveBeenCalled()
})
it('still accepts the optional secret header as the gate', async () => {
  expect((await webhook(notify('', form, { 'x-tranzila-webhook-secret': 'test-secret' }))).status).toBe(200)
})
it('is 503 when the terminal is half-configured', async () => {
  vi.stubEnv('TRANZILA_API_SECRET', '')
  expect((await webhook(notify(`?o=user_offer&t=${token()}`))).status).toBe(503)
})

// ---- initiate: handshake ----
const handshakeOk = () => vi.fn(async () => new Response(JSON.stringify({ error_code: 0, message: 'Success', thtk: 'abcdefgh12345678' })))
it('returns no payment block before the terms are accepted and never calls Tranzila', async () => {
  const fetchMock = handshakeOk(); vi.stubGlobal('fetch', fetchMock)
  const res = await initiate(authed('/api/payments/initiate', { offerId: 'offer' }))
  expect(res.status).toBe(200)
  expect((await res.json()).payment).toBeNull()
  expect(fetchMock).not.toHaveBeenCalled()
})
it('issues a handshake bound to the frozen amount, with a signed notify URL, once the terms are accepted', async () => {
  const fetchMock = handshakeOk(); vi.stubGlobal('fetch', fetchMock)
  const res = await initiate(authed('/api/payments/initiate', { offerId: 'offer', acceptTerms: true, amountAgorot: 1 }))
  const data = await res.json()
  expect(res.status).toBe(200)
  expect(data.sandbox).toBe(false)
  expect(data.payment).toMatchObject({ provider: 'tranzila-hosted-fields', terminal, thtk: 'abcdefgh12345678', amountAgorot: 1025, currency: 'ILS' })
  expect(JSON.parse((fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1].body as string)).toMatchObject({ terminal_name: terminal, sum: 10.25 })
  const url = new URL(data.payment.notifyUrl)
  expect(url.origin).toBe('https://landly.test')
  expect(verifyNotifyToken(url.searchParams.get('t'), claims, 'test-secret')).toBe(true)
})
it('answers 503 and keeps the order when the handshake is refused', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ error_code: 400 }), { status: 400 })))
  expect((await initiate(authed('/api/payments/initiate', { offerId: 'offer', acceptTerms: true }))).status).toBe(503)
})
it('caps handshakes per order', async () => {
  vi.stubGlobal('fetch', handshakeOk())
  for (let i = 0; i < MAX_HANDSHAKES_PER_ORDER; i++) expect((await initiate(authed('/api/payments/initiate', { offerId: 'offer', acceptTerms: true }))).status).toBe(200)
  expect((await initiate(authed('/api/payments/initiate', { offerId: 'offer', acceptTerms: true }))).status).toBe(429)
})
it('is 503 for a half-configured terminal', async () => {
  vi.stubEnv('TRANZILA_API_APP_KEY', '')
  expect((await initiate(authed('/api/payments/initiate', { offerId: 'offer' }))).status).toBe(503)
})

// ---- confirm ----
it('requires authentication', async () => {
  mocks.verifiedUid.mockRejectedValue(new mocks.MockRequestAuthError('Unauthorized', 401))
  expect((await confirm(authed('/api/payments/confirm', { orderId: 'user_offer' }))).status).toBe(401)
  expect(mocks.getDb).not.toHaveBeenCalled()
})
it('treats someone else\'s order as missing', async () => {
  mocks.verifiedUid.mockResolvedValue('intruder')
  expect((await confirm(authed('/api/payments/confirm', { orderId: 'user_offer' }))).status).toBe(404)
})
it('rejects a sandbox order', async () => {
  store.seed('orders/user_offer', { ...pending, terminal: 'landly_sandbox' })
  expect((await confirm(authed('/api/payments/confirm', { orderId: 'user_offer' }))).status).toBe(409)
})
it('answers 202 pending while Tranzila holds nothing for the order yet', async () => {
  tranzila.current = null
  const res = await confirm(authed('/api/payments/confirm', { orderId: 'user_offer' }))
  expect(res.status).toBe(202)
  expect((await res.json()).status).toBe('pending')
  expect(store.read('orders/user_offer')?.status).toBe('pending')
})
it('settles from Tranzila\'s record, ignores any client-sent amount, and converges with a later notify', async () => {
  const res = await confirm(authed('/api/payments/confirm', { orderId: 'user_offer', amountAgorot: 1, tranzilaTxnId: '666' }))
  expect(await res.json()).toEqual({ orderId: 'user_offer', status: 'paid' })
  expect(store.read('orders/user_offer')?.tranzilaTxnId).toBe('123')
  expect(await (await webhook(notify(`?o=user_offer&t=${token()}`))).text()).toBe('OK')
  expect(store.count('vouchers')).toBe(1)
  expect(mocks.scheduleConfirmation).toHaveBeenCalledOnce()
  // A settled order is simply reported.
  expect((await (await confirm(authed('/api/payments/confirm', { orderId: 'user_offer' }))).json()).status).toBe('paid')
})
it('FAILS CLOSED: the default verifier gives 503 and no settlement', async () => {
  setTranzilaVerifier(null)
  const before = store.snapshot()
  expect((await confirm(authed('/api/payments/confirm', { orderId: 'user_offer' }))).status).toBe(503)
  expect(store.snapshot()).toEqual(before)
})
it('refuses a Tranzila record that does not match the frozen order', async () => {
  tranzila.current = { ...verifiedTx, amountAgorot: 1 }
  expect((await confirm(authed('/api/payments/confirm', { orderId: 'user_offer' }))).status).toBe(409)
  expect(store.count('vouchers')).toBe(0)
})

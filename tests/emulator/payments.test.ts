import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { Firestore, type Transaction } from 'firebase-admin/firestore'
import { claimOfferForOrder } from '@/lib/payments/claimOfferForOrder'
import { initiateOrder } from '@/lib/payments/initiateOrder'
import { business, event, offer, pending, terminal } from '../helpers/paymentFixtures'

// Hard stop, not skip: these tests must NEVER silently connect to production.
if (process.env.FIRESTORE_EMULATOR_HOST !== '127.0.0.1:8787') {
  throw new Error('Run npm run test:emulator; only the isolated loopback emulator is permitted.')
}
const db = new Firestore({ projectId: 'demo-landly-payments' })
const collections = ['orders', 'offers', 'businesses', 'vouchers', 'paymentTransactions', 'metadata', 'orderCounter']

async function snapshot() {
  const entries = await Promise.all(collections.map(async (name) => {
    const snap = await db.collection(name).get()
    return snap.docs.map((doc) => [doc.ref.path, doc.data()] as const)
  }))
  return Object.fromEntries(entries.flat())
}
async function assertFulfilled() {
  expect((await db.doc('orders/user_offer').get()).data()).toMatchObject({ status: 'paid', tranzilaTxnId: '123', voucherId: 'user_offer' })
  expect((await db.collection('vouchers').get()).size).toBe(1)
  expect((await db.collection('paymentTransactions').get()).size).toBe(1)
  expect((await db.doc('offers/offer').get()).get('claimedCount')).toBe(1)
  // Checkout no longer writes the shared business doc; its active count is counted on read.
  expect((await db.doc('businesses/business').get()).get('voucherStats.active')).toBe(0)
}

beforeEach(async () => {
  // The orders' server-only internal documents (subcollections) go too, or one test's terms would shadow the next test's order.
  const docs = [...(await Promise.all(collections.map((name) => db.collection(name).get()))), await db.collectionGroup('internal').get()].flatMap((snap) => snap.docs)
  const batch = db.batch()
  for (const doc of docs) batch.delete(doc.ref)
  await batch.commit()
  await Promise.all([
    db.doc('orders/user_offer').set(pending),
    db.doc('offers/offer').set(offer),
    db.doc('businesses/business').set(business),
  ])
})
afterAll(async () => { await db.terminate() })

describe('real Firestore transactions', () => {
  it('settles simultaneous identical callbacks once, then handles a lost-response retry', async () => {
    await Promise.all(Array.from({ length: 4 }, () => claimOfferForOrder(db, event)))
    await assertFulfilled()
    const before = await snapshot()
    expect(await claimOfferForOrder(db, event)).toEqual({ alreadyProcessed: true })
    expect(await snapshot()).toEqual(before)
  })
  it('aborts all queued writes when an error occurs before commit', async () => {
    const before = await snapshot()
    const injected = {
      collection: db.collection.bind(db),
      runTransaction: (work: (tx: Transaction) => Promise<unknown>) => db.runTransaction(async (tx) => {
        await work(tx)
        throw new Error('injected pre-commit failure')
      }),
    } as unknown as Firestore
    await expect(claimOfferForOrder(injected, event)).rejects.toThrow('injected pre-commit failure')
    expect(await snapshot()).toEqual(before)
    await claimOfferForOrder(db, event)
    await assertFulfilled()
  })
  it('reruns the callback on an injected ABORTED transaction without partial writes', async () => {
    let attempts = 0
    const injected = {
      collection: db.collection.bind(db),
      runTransaction: (work: (tx: Transaction) => Promise<unknown>) => db.runTransaction(async (tx) => {
        const result = await work(tx)
        if (++attempts === 1) throw Object.assign(new Error('injected contention'), { code: 10 })
        return result
      }),
    } as unknown as Firestore
    await claimOfferForOrder(injected, event)
    expect(attempts).toBe(2)
    await assertFulfilled()
  })
  it('creates one order for concurrent initiations', async () => {
    await db.doc('orders/user_offer').delete()
    const responses = await Promise.all(Array.from({ length: 4 }, () => initiateOrder(db, 'user', 'offer', terminal)))
    expect(responses.every((result) => JSON.stringify(result) === JSON.stringify(responses[0]))).toBe(true)
    expect((await db.collection('orders').get()).size).toBe(1)
    expect((await db.doc('orders/user_offer').get()).get('status')).toBe('pending')
  })
  it('never resets a paid order when initiation overlaps settlement', async () => {
    const results = await Promise.allSettled([
      initiateOrder(db, 'user', 'offer', terminal),
      claimOfferForOrder(db, event),
      initiateOrder(db, 'user', 'offer', terminal),
    ])
    expect(results[1].status).toBe('fulfilled')
    await assertFulfilled()
  })
  it('prevents one transaction from fulfilling two orders concurrently', async () => {
    await db.doc('orders/other_offer').set({ ...pending, userId: 'other' })
    const results = await Promise.allSettled([
      claimOfferForOrder(db, event), claimOfferForOrder(db, { ...event, orderId: 'other_offer' }),
    ])
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1)
    expect((await db.collection('vouchers').get()).size).toBe(1)
    expect((await db.collection('paymentTransactions').get()).size).toBe(1)
    expect((await db.doc('offers/offer').get()).get('claimedCount')).toBe(1)
  })
  it('rejects a second charge or a failure against an already paid order', async () => {
    await claimOfferForOrder(db, event)
    const before = await snapshot()
    await expect(claimOfferForOrder(db, { ...event, tranzilaTxnId: '999' })).rejects.toThrow()
    await expect(claimOfferForOrder(db, { ...event, approved: false, responseCode: '005' })).rejects.toThrow()
    expect(await snapshot()).toEqual(before)
  })
  it('preserves failed orders when initiation or contradictory success arrives', async () => {
    // The dev sandbox keeps a decline final; on a live terminal a decline leaves the order pending (see the settlement tests below).
    await db.doc('orders/user_offer').update({ terminal: 'landly_sandbox' })
    const sandbox = { ...event, terminal: 'landly_sandbox' }
    await claimOfferForOrder(db, { ...sandbox, approved: false, responseCode: '005' })
    const before = await snapshot()
    await expect(initiateOrder(db, 'user', 'offer', 'landly_sandbox')).rejects.toThrow()
    await expect(claimOfferForOrder(db, sandbox)).rejects.toThrow()
    expect(await snapshot()).toEqual(before)
  })
  it('does not mark a paid notification failed when stock is exhausted', async () => {
    await db.doc('offers/offer').update({ totalQuantity: 1, claimedCount: 1 })
    const before = await snapshot()
    await expect(claimOfferForOrder(db, event)).rejects.toThrow('reconciliation')
    expect(await snapshot()).toEqual(before)
  })

  it('keeps commission terms, the held code and the coordinates off the member-readable order', async () => {
    await db.doc('orders/user_offer').delete()
    await db.doc('businesses/business').set({ ...business, commissionRate: 0.1, paymentTerms: 'net_30' })
    await initiateOrder(db, 'user', 'offer', terminal)
    const order = (await db.doc('orders/user_offer').get()).data()!
    expect(order).not.toHaveProperty('commissionRate')
    expect(order).not.toHaveProperty('paymentTerms')
    expect(order).not.toHaveProperty('reservedVoucherId')
    expect(order).not.toHaveProperty('businessGeo')
    expect((await db.doc('orders/user_offer/internal/terms').get()).data()).toMatchObject({ commissionRate: 0.1, paymentTerms: 'net_30' })
    // Settlement reads the terms back from the internal document.
    await claimOfferForOrder(db, event)
    expect((await db.doc('vouchers/user_offer').get()).data()).toMatchObject({ commissionRate: 0.1, paymentTerms: 'net_30' })
  })
})

// ---- Hosted Fields: verified settlement and the handshake budget (lib/payments/settleVerifiedPayment.ts) ----
import { MAX_HANDSHAKES_PER_ORDER, takeHandshake } from '@/lib/payments/handshakeBudget'
import { settleOrderById } from '@/lib/payments/settleVerifiedPayment'
import { verifiedTx } from '../helpers/tranzilaLive'
import type { TranzilaTransactionVerifier } from '@/lib/payments/verifyTranzilaTransaction'

describe('verified settlement against the emulator', () => {
  const tranzila = (record: typeof verifiedTx | null): TranzilaTransactionVerifier => ({
    byTransactionId: async (_t, id) => (record && record.tranzilaTxnId === id ? record : null),
    byOrderId: async () => record,
  })
  const declined = { ...verifiedTx, tranzilaTxnId: '124', approved: false, responseCode: '005' }

  it('settles once from Tranzila\'s record, and a replay or a second Notify converges on the same receipt', async () => {
    expect((await settleOrderById(db, 'user_offer', { verifier: tranzila(verifiedTx) })).alreadyProcessed).toBe(false)
    await assertFulfilled()
    expect((await settleOrderById(db, 'user_offer', { verifier: tranzila(verifiedTx) })).alreadyProcessed).toBe(true)
    await assertFulfilled()
  })
  it('settles nothing when Tranzila holds nothing, or reports another amount', async () => {
    const before = await snapshot()
    expect(await settleOrderById(db, 'user_offer', { verifier: tranzila(null) })).toMatchObject({ status: 'pending' })
    await expect(settleOrderById(db, 'user_offer', { verifier: tranzila({ ...verifiedTx, amountAgorot: 999 }) })).rejects.toMatchObject({ status: 409 })
    expect(await snapshot()).toEqual(before)
  })
  it('rejects a Notify whose signed amount is not the order\'s', async () => {
    await expect(settleOrderById(db, 'user_offer', { verifier: tranzila(verifiedTx), expectedAmountAgorot: 1 })).rejects.toThrow('reconciliation')
  })
  it('keeps a declined live order pending and retryable, then settles a later approved attempt', async () => {
    const result = await settleOrderById(db, 'user_offer', { verifier: tranzila(declined) })
    expect(result).toMatchObject({ status: 'declined', approved: false })
    const order = (await db.doc('orders/user_offer').get()).data()!
    expect(order.status).toBe('pending')
    expect(order.responseCode).toBe('005')
    expect((await db.doc('vouchers/user_offer').get()).exists).toBe(false)
    // The declined attempt is kept as an audit receipt, and a replay of it changes nothing.
    expect((await settleOrderById(db, 'user_offer', { verifier: tranzila(declined) })).alreadyProcessed).toBe(true)
    expect((await db.doc('orders/user_offer').get()).get('status')).toBe('pending')
    // The member retries with another card: the approved attempt settles the same order.
    await settleOrderById(db, 'user_offer', { verifier: tranzila(verifiedTx) })
    expect((await db.doc('orders/user_offer').get()).data()).toMatchObject({ status: 'paid', tranzilaTxnId: '123', voucherId: 'user_offer' })
    expect((await db.collection('vouchers').get()).size).toBe(1)
    expect((await db.collection('paymentTransactions').get()).size).toBe(2) // the decline and the approval
    expect((await db.doc('offers/offer').get()).get('claimedCount')).toBe(1)
  })
  it('keeps a decline on the dev sandbox terminal final (failed)', async () => {
    await db.doc('orders/user_offer').update({ terminal: 'landly_sandbox' })
    const result = await claimOfferForOrder(db, { ...event, terminal: 'landly_sandbox', approved: false, responseCode: '005' })
    expect(result.retryable).toBeFalsy()
    expect((await db.doc('orders/user_offer').get()).get('status')).toBe('failed')
  })
  it('caps handshakes per order on the server-only internal document', async () => {
    for (let i = 0; i < MAX_HANDSHAKES_PER_ORDER; i++) await takeHandshake(db, 'user_offer')
    await expect(takeHandshake(db, 'user_offer')).rejects.toMatchObject({ status: 429 })
    expect((await db.doc('orders/user_offer/internal/handshakes').get()).get('count')).toBe(MAX_HANDSHAKES_PER_ORDER)
  })
})

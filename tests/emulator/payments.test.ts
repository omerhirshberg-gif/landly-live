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
const collections = ['orders', 'offers', 'businesses', 'vouchers', 'paymentTransactions']

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
  expect((await db.doc('businesses/business').get()).get('voucherStats.active')).toBe(1)
}

beforeEach(async () => {
  const docs = (await Promise.all(collections.map((name) => db.collection(name).get()))).flatMap((snap) => snap.docs)
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
    await claimOfferForOrder(db, { ...event, approved: false, responseCode: '005' })
    const before = await snapshot()
    await expect(initiateOrder(db, 'user', 'offer', terminal)).rejects.toThrow()
    await expect(claimOfferForOrder(db, event)).rejects.toThrow()
    expect(await snapshot()).toEqual(before)
  })
  it('does not mark a paid notification failed when stock is exhausted', async () => {
    await db.doc('offers/offer').update({ totalQuantity: 1, claimedCount: 1 })
    const before = await snapshot()
    await expect(claimOfferForOrder(db, event)).rejects.toThrow('reconciliation')
    expect(await snapshot()).toEqual(before)
  })
})

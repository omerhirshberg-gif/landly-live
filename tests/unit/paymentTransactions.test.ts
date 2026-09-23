import { describe, expect, it } from 'vitest'
import { claimOfferForOrder } from '@/lib/payments/claimOfferForOrder'
import { initiateOrder } from '@/lib/payments/initiateOrder'
import { TransactionStore, deferred } from '../helpers/transactionStore'
import { business, event, offer, pending, terminal } from '../helpers/paymentFixtures'

function store(withOrder = true) {
  const db = new TransactionStore()
  db.seed('offers/offer', offer)
  db.seed('businesses/business', business)
  if (withOrder) db.seed('orders/user_offer', pending)
  return db
}
function fulfilled(db: TransactionStore) {
  expect(db.read('orders/user_offer')).toMatchObject({ status: 'paid', tranzilaTxnId: '123', voucherId: 'user_offer' })
  expect(db.count('vouchers')).toBe(1)
  expect(db.count('paymentTransactions')).toBe(1)
  expect(db.read('offers/offer')?.claimedCount).toBe(1)
  expect(db.read('businesses/business')?.voucherStats.active).toBe(1)
}
function pauseNextCommit(db: TransactionStore) {
  const entered = deferred(), release = deferred()
  db.beforeCommit = async () => { entered.resolve(); await release.promise }
  return { entered, release }
}

describe('atomic payment settlement', () => {
  it('commits all five documents together', async () => {
    const db = store()
    await claimOfferForOrder(db.db, event)
    fulfilled(db)
  })
  it('rolls everything back on an injected pre-commit failure, then permits retry', async () => {
    const db = store(), before = db.snapshot()
    db.beforeCommit = async () => { throw new Error('commit unavailable') }
    await expect(claimOfferForOrder(db.db, event)).rejects.toThrow('commit unavailable')
    expect(db.snapshot()).toEqual(before)
    await claimOfferForOrder(db.db, event)
    fulfilled(db)
  })
  it('survives a lost HTTP response after commit without double fulfillment', async () => {
    const db = store()
    await expect((async () => { await claimOfferForOrder(db.db, event); throw new Error('response lost') })()).rejects.toThrow('response lost')
    const before = db.snapshot()
    expect(await claimOfferForOrder(db.db, event)).toEqual({ alreadyProcessed: true })
    expect(db.snapshot()).toEqual(before)
    fulfilled(db)
  })
  it('retries a conflicting concurrent callback and fulfills exactly once', async () => {
    const db = store(), gate = pauseNextCommit(db)
    const first = claimOfferForOrder(db.db, event)
    await gate.entered.promise
    await claimOfferForOrder(db.db, event)
    gate.release.resolve()
    expect(await first).toEqual({ alreadyProcessed: true })
    expect(db.attempts).toBe(3)
    fulfilled(db)
  })
  it('rejects reuse of a transaction on another order', async () => {
    const db = store()
    db.seed('orders/other_offer', { ...pending, userId: 'other' })
    await claimOfferForOrder(db.db, event)
    const before = db.snapshot()
    await expect(claimOfferForOrder(db.db, { ...event, orderId: 'other_offer' })).rejects.toThrow('Conflicting transaction replay')
    expect(db.snapshot()).toEqual(before)
  })
  it.each([
    { responseCode: '005', approved: false },
    { tranzilaTxnId: '456' },
    { amountAgorot: 500 },
    { terminal: 'other' },
  ])('does not overwrite a paid order with %j', async (change) => {
    const db = store()
    await claimOfferForOrder(db.db, event)
    const before = db.snapshot()
    await expect(claimOfferForOrder(db.db, { ...event, ...change })).rejects.toThrow()
    expect(db.snapshot()).toEqual(before)
  })
  it('records an identified failure atomically; failure replay is idempotent and later success conflicts', async () => {
    const db = store(), failure = { ...event, approved: false, responseCode: '005' }
    await claimOfferForOrder(db.db, failure)
    expect(db.read('orders/user_offer')?.status).toBe('failed')
    expect(db.count('vouchers')).toBe(0)
    expect(db.count('paymentTransactions')).toBe(1)
    const before = db.snapshot()
    expect(await claimOfferForOrder(db.db, failure)).toEqual({ alreadyProcessed: true })
    await expect(claimOfferForOrder(db.db, event)).rejects.toThrow()
    expect(db.snapshot()).toEqual(before)
  })
  it.each(['stock', 'expired', 'business', 'legacy', 'voucher'])('leaves %s conflicts unchanged for reconciliation', async (condition) => {
    const db = store()
    if (condition === 'stock') db.seed('offers/offer', { ...offer, totalQuantity: 1, claimedCount: 1 })
    if (condition === 'expired') db.seed('offers/offer', { ...offer, expiryDate: pending.createdAt })
    if (condition === 'business') db.seed('orders/user_offer', { ...pending, businessId: 'missing' })
    if (condition === 'legacy') db.seed('orders/user_offer', { ...pending, status: 'paid' })
    if (condition === 'voucher') db.seed('vouchers/user_offer', { userId: 'user' })
    const before = db.snapshot()
    await expect(claimOfferForOrder(db.db, event)).rejects.toThrow()
    expect(db.snapshot()).toEqual(before)
  })
})

describe('safe initiation', () => {
  it('creates once and reuses the frozen price even when the offer price changes', async () => {
    const db = store(false)
    const first = await initiateOrder(db.db, 'user', 'offer', terminal)
    const order = db.read('orders/user_offer')
    db.seed('offers/offer', { ...offer, offerPrice: 99 })
    expect(await initiateOrder(db.db, 'user', 'offer', terminal)).toEqual(first)
    expect(db.read('orders/user_offer')).toEqual(order)
  })
  it.each(['failed', 'paid', 'unknown'])('never reopens %s', async (status) => {
    const db = store()
    db.seed('orders/user_offer', { ...pending, status })
    const before = db.snapshot()
    await expect(initiateOrder(db.db, 'user', 'offer', terminal)).rejects.toThrow()
    expect(db.snapshot()).toEqual(before)
  })
  it('two simultaneous initiations create only one order', async () => {
    const db = store(false), gate = pauseNextCommit(db)
    const first = initiateOrder(db.db, 'user', 'offer', terminal)
    await gate.entered.promise
    const second = await initiateOrder(db.db, 'user', 'offer', terminal)
    gate.release.resolve()
    expect(await first).toEqual(second)
    expect(db.count('orders')).toBe(1)
    expect(db.attempts).toBe(3)
  })
  it('initiation loses a race to settlement and cannot reset paid state', async () => {
    const db = store(), gate = pauseNextCommit(db)
    const opening = initiateOrder(db.db, 'user', 'offer', terminal)
    await gate.entered.promise
    await claimOfferForOrder(db.db, event)
    gate.release.resolve()
    await expect(opening).rejects.toThrow()
    fulfilled(db)
  })
  it('settlement remains valid when initiation returns first', async () => {
    const db = store(), gate = pauseNextCommit(db)
    const settling = claimOfferForOrder(db.db, event)
    await gate.entered.promise
    const before = db.read('orders/user_offer')
    await initiateOrder(db.db, 'user', 'offer', terminal)
    expect(db.read('orders/user_offer')).toEqual(before)
    gate.release.resolve()
    await settling
    fulfilled(db)
  })
})

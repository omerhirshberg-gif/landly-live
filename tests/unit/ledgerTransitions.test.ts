import { beforeAll, describe, expect, it } from 'vitest'
import { Timestamp } from 'firebase-admin/firestore'
import { randomBytes } from 'node:crypto'
import { planTransition, transitionVoucherStatus, TransitionError, ALLOWED, adjustVoucherBalance, type VoucherState } from '@/lib/inventory/ledger/transitions'
import { releaseExpiredReservations, reserveForCheckout } from '@/lib/inventory/ledger/stock'
import { VOUCHER_STATUSES, type InventoryStatus } from '@/lib/inventory/ledger/types'
import { hashCode, maskCode, maskCodesDeep, scrubText } from '@/lib/inventory/ledger/codes'
import { TransactionStore } from '../helpers/transactionStore'

beforeAll(() => { process.env.POOL_CODES_KEY = randomBytes(32).toString('base64') })

const T0 = Timestamp.fromMillis(Date.UTC(2026, 5, 1, 9))
const state = (status: InventoryStatus, extra: Partial<VoucherState> = {}): VoucherState => ({
  status, supplierId: 'raayonit', faceValueAgorot: 10000, balanceAgorot: 10000, expiresAt: null, soldAt: null, reservedUntil: null, reservedForOrderId: null, ...extra,
})

describe('transition table', () => {
  it('allows exactly the specified edges', () => {
    const expected: Record<string, string[]> = {
      IN_STOCK: ['RESERVED', 'EXPIRED', 'VOID'], RESERVED: ['IN_STOCK', 'SOLD', 'VOID'], SOLD: ['DELIVERED', 'CANCELLED', 'VOID'],
      DELIVERED: ['PARTIALLY_REDEEMED', 'REDEEMED', 'CANCELLED', 'EXPIRED', 'VOID'],
    }
    for (const [from, tos] of Object.entries(expected)) expect([...ALLOWED[from as InventoryStatus]].sort()).toEqual([...tos].sort())
  })
  it('never leaves a terminal state, and any other state may be voided', () => {
    for (const s of ['REDEEMED', 'EXPIRED', 'VOID'] as const) for (const to of VOUCHER_STATUSES) expect(() => planTransition(state(s), to, { reason: 'x', actor: 'a' })).toThrow(TransitionError)
    for (const s of VOUCHER_STATUSES.filter((x) => !['REDEEMED', 'EXPIRED', 'VOID'].includes(x))) expect(planTransition(state(s), 'VOID', { reason: 'fraud', actor: 'admin' }).to).toBe('VOID')
  })
  it('requires a reason and an actor to void', () => {
    expect(() => planTransition(state('IN_STOCK'), 'VOID', {})).toThrow(/reason/)
    expect(() => planTransition(state('IN_STOCK'), 'VOID', { reason: 'x' })).toThrow(/actor/)
  })
  it('refuses IN_STOCK -> SOLD, and a sale for another order', () => {
    expect(() => planTransition(state('IN_STOCK'), 'SOLD', { orderId: 'o1' })).toThrow(TransitionError)
    expect(() => planTransition(state('RESERVED', { reservedForOrderId: 'o2' }), 'SOLD', { orderId: 'o1' })).toThrow(/another order/)
  })
  it('reserves for 15 minutes and clears the hold on sale', () => {
    const r = planTransition(state('IN_STOCK'), 'RESERVED', { orderId: 'o1', now: T0 })
    expect((r.patch.reservedUntil as Timestamp).toMillis() - T0.toMillis()).toBe(15 * 60_000)
    const s = planTransition(r.next, 'SOLD', { orderId: 'o1', now: T0 })
    expect(s.patch.reservedUntil).toBeNull()
    expect(s.event.type).toBe('SOLD')
  })
  it('expires 5 years after the sale, or at the batch date when that is earlier', () => {
    const r = planTransition(state('IN_STOCK'), 'RESERVED', { orderId: 'o', now: T0 }).next
    const five = (planTransition(r, 'SOLD', { orderId: 'o', now: T0 }).patch.expiresAt as Timestamp).toDate().getUTCFullYear()
    expect(five).toBe(2031)
    const early = Timestamp.fromMillis(Date.UTC(2027, 0, 1))
    const r2 = planTransition(state('IN_STOCK', { expiresAt: early }), 'RESERVED', { orderId: 'o', now: T0 }).next
    expect((planTransition(r2, 'SOLD', { orderId: 'o', now: T0 }).patch.expiresAt as Timestamp).toMillis()).toBe(early.toMillis())
  })
  it('will not reserve a code already past its expiry', () => {
    expect(() => planTransition(state('IN_STOCK', { expiresAt: Timestamp.fromMillis(T0.toMillis() - 1) }), 'RESERVED', { orderId: 'o', now: T0 })).toThrow(/expired/)
  })
  it('tracks partial and full redemption through the balance', () => {
    const p = planTransition(state('DELIVERED'), 'PARTIALLY_REDEEMED', { amountAgorot: 3000, source: 'multipass' })
    expect(p.next.balanceAgorot).toBe(7000)
    expect(() => planTransition(p.next, 'PARTIALLY_REDEEMED', { amountAgorot: 7000 })).toThrow(/REDEEMED/)
    const done = planTransition(p.next, 'REDEEMED', {})
    expect(done.next.balanceAgorot).toBe(0)
    expect(() => planTransition(p.next, 'REDEEMED', { amountAgorot: 1 })).toThrow(/zero/)
    expect(() => planTransition(state('DELIVERED'), 'PARTIALLY_REDEEMED', { amountAgorot: 99999 })).toThrow(/invalid/)
  })
  it('cancels only inside 14 days, untouched and with the supplier balance verified', () => {
    const sold = T0
    const ok = state('DELIVERED', { soldAt: sold })
    const inside = Timestamp.fromMillis(sold.toMillis() + 13 * 86_400_000)
    expect(planTransition(ok, 'CANCELLED', { now: inside, verifiedBalanceAgorot: 10000 }).to).toBe('CANCELLED')
    expect(() => planTransition(ok, 'CANCELLED', { now: Timestamp.fromMillis(sold.toMillis() + 15 * 86_400_000), verifiedBalanceAgorot: 10000 })).toThrow(/14 days/)
    expect(() => planTransition(ok, 'CANCELLED', { now: inside })).toThrow(/verified/)
    expect(() => planTransition(ok, 'CANCELLED', { now: inside, verifiedBalanceAgorot: 5000 })).toThrow(/verified/)
    expect(() => planTransition(state('DELIVERED', { soldAt: sold, balanceAgorot: 9000 }), 'CANCELLED', { now: inside, verifiedBalanceAgorot: 10000 })).toThrow(/untouched/)
  })
  it('never returns a cancelled voucher to stock without the supplier confirming the void', () => {
    expect(() => planTransition(state('CANCELLED'), 'IN_STOCK', {})).toThrow(/supplier/)
    expect(planTransition(state('CANCELLED'), 'IN_STOCK', { supplierVoidConfirmed: true }).event.type).toBe('RESTOCKED')
  })
  it('expires only after expiresAt', () => {
    expect(() => planTransition(state('IN_STOCK', { expiresAt: Timestamp.fromMillis(T0.toMillis() + 1000) }), 'EXPIRED', { now: T0 })).toThrow(/expiry/)
    expect(planTransition(state('PARTIALLY_REDEEMED', { expiresAt: T0 }), 'EXPIRED', { now: T0 }).to).toBe('EXPIRED')
  })
})

const seedVoucher = (store: TransactionStore, id: string, extra: Record<string, unknown> = {}) =>
  store.seed(`inventoryVouchers/${id}`, { ...state('IN_STOCK'), productId: 'p1', codeEncrypted: 'x', ...extra })
const events = (store: TransactionStore) => Object.entries(store.snapshot()).filter(([k]) => k.startsWith('voucherEvents/')).map(([, v]) => v as Record<string, any>)

describe('transitionVoucherStatus (transactional)', () => {
  it('writes the status and its event together, and replays an externalEventId once', async () => {
    const store = new TransactionStore()
    seedVoucher(store, 'a', { status: 'DELIVERED' })
    await transitionVoucherStatus(store.db, 'a', 'PARTIALLY_REDEEMED', { amountAgorot: 2000, source: 'multipass', externalEventId: 'ev1' })
    const again = await transitionVoucherStatus(store.db, 'a', 'PARTIALLY_REDEEMED', { amountAgorot: 2000, source: 'multipass', externalEventId: 'ev1' })
    expect(again.duplicate).toBe(true)
    expect(store.read('inventoryVouchers/a')!.balanceAgorot).toBe(8000)
    expect(events(store)).toHaveLength(1)
    expect(events(store)[0]).toMatchObject({ type: 'REDEMPTION', fromStatus: 'DELIVERED', toStatus: 'PARTIALLY_REDEEMED', amountAgorot: 2000, source: 'multipass' })
  })
  it('leaves no event and no change when the edge is refused', async () => {
    const store = new TransactionStore()
    seedVoucher(store, 'a')
    await expect(transitionVoucherStatus(store.db, 'a', 'SOLD', { orderId: 'o' })).rejects.toThrow(TransitionError)
    expect(store.read('inventoryVouchers/a')!.status).toBe('IN_STOCK')
    expect(events(store)).toHaveLength(0)
  })
  it('an adjustment records reason and actor, and refuses without them', async () => {
    const store = new TransactionStore()
    seedVoucher(store, 'a', { status: 'DELIVERED' })
    await expect(adjustVoucherBalance(store.db, 'a', 5000, {})).rejects.toThrow(/reason/)
    await adjustVoucherBalance(store.db, 'a', 5000, { reason: 'supplier statement', actor: 'admin' })
    expect(events(store)[0]).toMatchObject({ type: 'ADJUSTMENT', amountAgorot: -5000, meta: { reason: 'supplier statement', actor: 'admin' } })
  })
})

describe('checkout reservation under concurrency', () => {
  it('never hands one code to two checkouts, and sells out cleanly', async () => {
    const store = new TransactionStore()
    for (let i = 0; i < 5; i++) seedVoucher(store, `v${i}`)
    const results = await Promise.allSettled(Array.from({ length: 12 }, (_, i) => reserveForCheckout(store.db, 'p1', `order${i}`, T0)))
    const won = results.flatMap((r) => (r.status === 'fulfilled' ? [r.value.voucherId] : []))
    expect(won).toHaveLength(5)
    expect(new Set(won).size).toBe(5)
    expect(results.filter((r) => r.status === 'rejected')).toHaveLength(7)
    expect(events(store).filter((e) => e.type === 'RESERVED')).toHaveLength(5)
  })
  it('returns the same reservation to a repeated call for the same order', async () => {
    const store = new TransactionStore()
    seedVoucher(store, 'v0'); seedVoucher(store, 'v1')
    const a = await reserveForCheckout(store.db, 'p1', 'o1', T0)
    const b = await reserveForCheckout(store.db, 'p1', 'o1', T0)
    expect(b.voucherId).toBe(a.voucherId)
  })
  it('releases a reservation after its 15 minutes', async () => {
    const store = new TransactionStore()
    seedVoucher(store, 'v0')
    await reserveForCheckout(store.db, 'p1', 'o1', T0)
    const later = Timestamp.fromMillis(T0.toMillis() + 16 * 60_000)
    expect(store.read('inventoryVouchers/v0')!.status).toBe('RESERVED')
    await transitionVoucherStatus(store.db, 'v0', 'IN_STOCK', { now: later })
    expect(store.read('inventoryVouchers/v0')).toMatchObject({ status: 'IN_STOCK', reservedForOrderId: null })
    expect(typeof releaseExpiredReservations).toBe('function')
  })
})

describe('code masking', () => {
  it('shows at most the last 4 characters', () => {
    expect(maskCode('ABCD-1234-5678')).toBe('••••5678')
    expect(maskCode('short')).toBe('••••')
    expect(hashCode(' abc ')).toBe(hashCode('abc'))
  })
  it('masks code fields and code-shaped runs everywhere', () => {
    const out = JSON.stringify(maskCodesDeep({ code: '1234567890123456', nested: { externalCode: 'ABCDEFGH1234', note: 'row 5 had 9876543210987 in it' }, n: 3 }))
    expect(out).not.toContain('1234567890123456')
    expect(out).not.toContain('ABCDEFGH1234')
    expect(out).not.toContain('9876543210987')
    expect(scrubText('plain words only')).toBe('plain words only')
  })
})

import 'server-only'
import { Timestamp, type Firestore, type Transaction } from 'firebase-admin/firestore'
import { mergeOrderInternal, orderInternalRef } from '@/lib/payments/orderInternal'
import { PaymentError } from '@/lib/payments/paymentValidation'
import { commitPlan, eventRefFor, planTransition, TransitionError, transitionVoucherStatus, type TransitionPlan, type VoucherState } from './transitions'
import { EVENTS_COLLECTION, PRODUCTS_COLLECTION, VOUCHERS_COLLECTION, type SupplierId } from './types'

// Stock operations on top of the single transition function: counting, the checkout reservation, releasing stale ones,
// and the settlement chain (RESERVED -> SOLD -> DELIVERED) that claimOfferForOrder runs inside its own transaction.

const CANDIDATES = 8

/** Whether a product's stock lives in the ledger (it does once the pool was migrated or the product created there). */
export async function ledgerProductExists(db: Firestore, productId: string): Promise<boolean> {
  return (await db.collection(PRODUCTS_COLLECTION).doc(productId).get()).exists
}

/** Codes a buyer could get now: IN_STOCK and not past a batch expiry. Aggregation count, so no hot counter document. */
export async function countInStock(db: Firestore, productId: string): Promise<number> {
  const q = db.collection(VOUCHERS_COLLECTION).where('productId', '==', productId).where('status', '==', 'IN_STOCK')
  const agg = (q as unknown as { count?: () => { get: () => Promise<{ data: () => { count: number } }> } }).count
  if (typeof agg === 'function') return (await agg.call(q).get()).data().count
  return (await q.get()).docs.length
}

export async function countByStatus(db: Firestore, productId: string, status: string): Promise<number> {
  const q = db.collection(VOUCHERS_COLLECTION).where('productId', '==', productId).where('status', '==', status)
  const agg = (q as unknown as { count?: () => { get: () => Promise<{ data: () => { count: number } }> } }).count
  if (typeof agg === 'function') return (await agg.call(q).get()).data().count
  return (await q.get()).docs.length
}

const shuffle = <T,>(items: T[]): T[] => {
  const out = [...items]
  for (let i = out.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [out[i], out[j]] = [out[j]!, out[i]!] }
  return out
}

/** Up to a handful of IN_STOCK ids for a product, in random order, so concurrent buyers rarely pick the same one. */
export async function pickCandidates(db: Firestore, productId: string, limit = CANDIDATES): Promise<string[]> {
  const snap = await db.collection(VOUCHERS_COLLECTION).where('productId', '==', productId).where('status', '==', 'IN_STOCK').limit(limit).get()
  return shuffle(snap.docs.map((d) => d.id))
}

export interface Reservation { voucherId: string; reservedUntil: Timestamp }

/**
 * IN_STOCK -> RESERVED for 15 minutes, atomically: each attempt is one transaction on one voucher, so two checkouts can never
 * hold the same code. A repeated call for the same order returns its existing reservation. Throws PaymentError when sold out.
 */
export async function reserveForCheckout(db: Firestore, productId: string, orderId: string, now: Timestamp = Timestamp.now()): Promise<Reservation> {
  const held = await db.collection(VOUCHERS_COLLECTION).where('reservedForOrderId', '==', orderId).where('status', '==', 'RESERVED').limit(1).get()
  const mine = held.docs[0]
  if (mine) {
    const until = mine.data().reservedUntil as Timestamp | null
    if (until && until.toMillis() > now.toMillis()) return { voucherId: mine.id, reservedUntil: until }
  }
  for (let round = 0; round < 3; round++) {
    const candidates = await pickCandidates(db, productId)
    if (candidates.length === 0) break
    for (const id of candidates) {
      try {
        const result = await transitionVoucherStatus(db, id, 'RESERVED', { orderId, now })
        return { voucherId: id, reservedUntil: result.voucher.reservedUntil as Timestamp }
      } catch (error) {
        // Taken by someone else a moment ago, or past its expiry: try the next one.
        if (error instanceof TransitionError) continue
        throw error
      }
    }
  }
  throw new PaymentError('This voucher value is out of stock.')
}

/** Most checkout holds one member may keep at once (each pending order holds one code for 15 minutes). */
export const MAX_HOLDS_PER_MEMBER = 3

/**
 * How many codes this member's OTHER pending orders still hold. Counted from the held vouchers themselves (RESERVED and not past
 * reservedUntil), so abandoned orders whose hold lapsed never count. Equality filters only, so no composite index.
 */
export async function countMemberHolds(db: Firestore, uid: string, exceptOrderId: string, now: Timestamp = Timestamp.now()): Promise<number> {
  const pending = await db.collection('orders').where('userId', '==', uid).where('status', '==', 'pending').limit(50).get()
  // The held code is on each order's server-only internal document (older orders: on the order itself).
  const others = pending.docs.filter((d) => d.id !== exceptOrderId)
  if (others.length === 0) return 0
  const internals = await db.getAll(...others.map((d) => orderInternalRef(db, d.id)))
  const ids = others.map((d, i) => mergeOrderInternal(d.data(), internals[i]?.data()).reservedVoucherId).filter((id): id is string => !!id)
  if (ids.length === 0) return 0
  const held = await db.getAll(...ids.map((id) => db.collection(VOUCHERS_COLLECTION).doc(id)))
  return held.filter((v) => v.exists && v.data()?.status === 'RESERVED' && v.data()?.reservedForOrderId !== exceptOrderId
    && ((v.data()?.reservedUntil as Timestamp | null)?.toMillis() ?? 0) > now.toMillis()).length
}

/** RESERVED -> IN_STOCK for one order (a failed or abandoned payment). A no-op when nothing is held. */
export async function releaseReservation(db: Firestore, orderId: string): Promise<number> {
  const held = await db.collection(VOUCHERS_COLLECTION).where('reservedForOrderId', '==', orderId).where('status', '==', 'RESERVED').get()
  let released = 0
  for (const doc of held.docs) {
    try { await transitionVoucherStatus(db, doc.id, 'IN_STOCK', { source: 'system', meta: { cause: 'payment_failed' } }); released++ } catch (error) { if (!(error instanceof TransitionError)) throw error }
  }
  return released
}

/** Frees every reservation whose 15 minutes passed. Run by the 5-minute cron; also safe to call any time. */
export async function releaseExpiredReservations(db: Firestore, now: Timestamp = Timestamp.now(), limit = 200): Promise<number> {
  const stale = await db.collection(VOUCHERS_COLLECTION).where('status', '==', 'RESERVED').where('reservedUntil', '<=', now).limit(limit).get()
  let released = 0
  for (const doc of stale.docs) {
    try {
      await transitionVoucherStatus(db, doc.id, 'IN_STOCK', { source: 'system', now, meta: { cause: 'reservation_expired' } })
      released++
    } catch (error) { if (!(error instanceof TransitionError)) throw error }
  }
  return released
}

export interface SettlementPlan {
  voucherRef: FirebaseFirestore.DocumentReference
  supplierId: SupplierId
  code: { cipher: string }
  plans: TransitionPlan[]
  voucher: VoucherState
  eventRefs: FirebaseFirestore.DocumentReference[]
}

/**
 * Reads for settlement (RESERVED -> SOLD -> DELIVERED), before the caller's first write. Uses the order's own reservation; if it was
 * released after the 15 minutes (the buyer paid late) it takes the code again, and otherwise the first IN_STOCK fallback.
 * The caller then calls `applySettlement` with the result.
 */
export async function planSettlement(db: Firestore, tx: Transaction, productId: string, orderId: string, reservedId: string | null, fallbackIds: readonly string[], now: Timestamp, walletVoucherId: string): Promise<SettlementPlan> {
  const order = [...(reservedId ? [reservedId] : []), ...fallbackIds.filter((id) => id !== reservedId)]
  for (const id of order) {
    const ref = db.collection(VOUCHERS_COLLECTION).doc(id)
    const snap = await tx.get(ref)
    if (!snap.exists) continue
    const current = snap.data() as VoucherState & { productId: string; codeEncrypted: string }
    if (current.productId !== productId) continue
    const mine = current.status === 'RESERVED' && current.reservedForOrderId === orderId
    const free = current.status === 'IN_STOCK'
    if (!mine && !free) continue
    const plans: TransitionPlan[] = []
    let state: VoucherState = current
    if (free) { const p = planTransition(state, 'RESERVED', { orderId, now }); plans.push(p); state = p.next }
    const sold = planTransition(state, 'SOLD', { orderId, now, source: 'system' })
    plans.push(sold)
    const delivered = planTransition(sold.next, 'DELIVERED', { orderId, now, walletVoucherId })
    plans.push(delivered)
    return { voucherRef: ref, supplierId: current.supplierId, code: { cipher: current.codeEncrypted }, plans, voucher: delivered.next, eventRefs: plans.map((p) => eventRefFor(db, current.supplierId, p.event.externalEventId)) }
  }
  throw new PaymentError('This offer is sold out; payment reconciliation is required.')
}

/** Writes: the voucher ends DELIVERED and every step leaves its event, all in the caller's transaction. */
export function applySettlement(db: Firestore, tx: Transaction, plan: SettlementPlan, now: Timestamp) {
  // One update carrying the net patch; one event per step (each its own create).
  const patch = plan.plans.reduce<Record<string, unknown>>((acc, p) => ({ ...acc, ...p.patch }), {})
  tx.update(plan.voucherRef, patch)
  plan.plans.forEach((p, i) => {
    tx.create(plan.eventRefs[i]!, {
      voucherId: plan.voucherRef.id, type: p.event.type, fromStatus: p.from, toStatus: p.to, amountAgorot: p.event.amountAgorot, businessId: p.event.businessId,
      source: p.event.source, externalEventId: p.event.externalEventId, occurredAt: now, meta: p.event.meta,
    })
  })
}

export { EVENTS_COLLECTION, commitPlan }

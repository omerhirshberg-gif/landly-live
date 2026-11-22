import 'server-only'
import { Timestamp, type DocumentData, type DocumentReference, type Firestore, type Transaction } from 'firebase-admin/firestore'
import { addYearsEndOfIsraelDayMs } from '@/lib/payments/voucherTerms'
import {
  CANCELLATION_WINDOW_DAYS, EVENTS_COLLECTION, RESERVATION_MS, TERMINAL_STATUSES, VOUCHERS_COLLECTION, VOUCHER_VALIDITY_YEARS,
  type EventSource, type InventoryStatus, type SupplierId, type VoucherEventType,
} from './types'

// THE one place a voucher's status changes. Iron rule: nothing else writes `status` on inventoryVouchers
// (tests/unit/ledgerIronRule.test.ts greps the codebase for it). Every change is planned by `planTransition`
// (pure, validates the edge and its guards, builds the patch and the ledger event) and committed by
// `commitPlan` inside a Firestore transaction together with its voucherEvents document.

export class TransitionError extends Error {
  constructor(message: string, readonly code: 'invalid_transition' | 'guard' | 'not_found' | 'missing_meta' = 'invalid_transition') {
    super(message)
  }
}

export interface TransitionContext {
  now?: Timestamp
  source?: EventSource
  /** Mandatory for VOID and ADJUSTMENT; recorded on every event that has one. */
  reason?: string
  actor?: string
  /** The order a reservation or sale belongs to. */
  orderId?: string
  /** The member's wallet voucher id, set when the code is delivered. */
  walletVoucherId?: string
  /** What a redemption takes off the balance, in agorot. Defaults to the whole balance. */
  amountAgorot?: number
  businessId?: string | null
  /** Idempotency: the supplier's own event id. Together with the supplier it names the event document. */
  externalEventId?: string
  /** Set only once the supplier has confirmed it voided the code: the one way CANCELLED returns to IN_STOCK. */
  supplierVoidConfirmed?: boolean
  /** The balance the supplier reported, checked by the CANCELLED guard (Admin cancel calls checkBalance first). */
  verifiedBalanceAgorot?: number
  meta?: Record<string, unknown>
}

/** from -> allowed to. VOID is handled separately: any non-terminal state may be voided. */
export const ALLOWED: Readonly<Record<InventoryStatus, readonly InventoryStatus[]>> = {
  STAGED: ['IN_STOCK', 'VOID'],
  IN_STOCK: ['RESERVED', 'EXPIRED', 'VOID'],
  RESERVED: ['IN_STOCK', 'SOLD', 'VOID'],
  SOLD: ['DELIVERED', 'CANCELLED', 'VOID'],
  DELIVERED: ['PARTIALLY_REDEEMED', 'REDEEMED', 'CANCELLED', 'EXPIRED', 'VOID'],
  PARTIALLY_REDEEMED: ['PARTIALLY_REDEEMED', 'REDEEMED', 'EXPIRED', 'VOID'],
  // Back to stock only once the supplier has confirmed the void (ctx.supplierVoidConfirmed).
  CANCELLED: ['IN_STOCK', 'VOID'],
  REDEEMED: [],
  EXPIRED: [],
  VOID: [],
}

export const isTerminal = (status: InventoryStatus) => TERMINAL_STATUSES.includes(status)

export interface VoucherState extends DocumentData {
  status: InventoryStatus
  supplierId: SupplierId
  faceValueAgorot: number
  balanceAgorot: number
  expiresAt: Timestamp | null
  soldAt: Timestamp | null
  reservedUntil: Timestamp | null
  reservedForOrderId: string | null
}

export interface TransitionPlan {
  from: InventoryStatus
  to: InventoryStatus
  patch: Record<string, unknown>
  event: { type: VoucherEventType; amountAgorot: number; source: EventSource; externalEventId: string | null; meta: Record<string, unknown>; businessId: string | null }
  next: VoucherState
}

const DAY_MS = 86_400_000

/** Pure: validates `current -> to` and returns what to write. Throws TransitionError. */
export function planTransition(current: VoucherState, to: InventoryStatus, ctx: TransitionContext = {}): TransitionPlan {
  const from = current.status
  const now = ctx.now ?? Timestamp.now()
  const allowed = to === 'VOID' ? !isTerminal(from) : ALLOWED[from]?.includes(to)
  if (!allowed) throw new TransitionError(`${from} -> ${to} is not an allowed transition.`)
  const meta: Record<string, unknown> = { ...(ctx.meta ?? {}) }
  if (ctx.reason) meta.reason = ctx.reason
  if (ctx.actor) meta.actor = ctx.actor
  if (ctx.orderId) meta.orderId = ctx.orderId
  if (ctx.walletVoucherId) meta.walletVoucherId = ctx.walletVoucherId
  const patch: Record<string, unknown> = { status: to, updatedAt: now }
  let type: VoucherEventType
  let amount = 0

  switch (to) {
    case 'IN_STOCK':
      if (from === 'STAGED') type = 'IMPORTED'
      else if (from === 'RESERVED') {
        type = 'RELEASED'
        patch.reservedUntil = null
        patch.reservedForOrderId = null
      } else {
        // CANCELLED -> IN_STOCK: never automatic; only once the supplier confirmed the void.
        if (!ctx.supplierVoidConfirmed) throw new TransitionError('A cancelled voucher returns to stock only after the supplier confirms the void.', 'guard')
        type = 'RESTOCKED'
        patch.orderItemId = null
        patch.soldAt = null
      }
      break
    case 'RESERVED':
      if (!ctx.orderId) throw new TransitionError('A reservation needs the order it is for.', 'guard')
      if (current.expiresAt && current.expiresAt.toMillis() <= now.toMillis()) throw new TransitionError('This code has expired.', 'guard')
      type = 'RESERVED'
      patch.reservedUntil = Timestamp.fromMillis(now.toMillis() + RESERVATION_MS)
      patch.reservedForOrderId = ctx.orderId
      break
    case 'SOLD': {
      // Strictly after the payment was confirmed server-side: the caller is the settlement transaction.
      if (!ctx.orderId) throw new TransitionError('A sale needs the order that paid for it.', 'guard')
      if (current.reservedForOrderId !== ctx.orderId) throw new TransitionError('This code is reserved for another order.', 'guard')
      type = 'SOLD'
      amount = current.faceValueAgorot
      patch.soldAt = now
      patch.orderItemId = ctx.orderId
      patch.reservedUntil = null
      patch.reservedForOrderId = null
      // 5 years from the purchase, or the batch's earlier date.
      const fiveYears = addYearsEndOfIsraelDayMs(now.toMillis(), VOUCHER_VALIDITY_YEARS)
      const batch = current.expiresAt?.toMillis()
      patch.expiresAt = Timestamp.fromMillis(batch !== undefined ? Math.min(batch, fiveYears) : fiveYears)
      break
    }
    case 'DELIVERED':
      type = 'DELIVERED'
      break
    case 'PARTIALLY_REDEEMED':
    case 'REDEEMED': {
      const take = ctx.amountAgorot ?? current.balanceAgorot
      if (!Number.isInteger(take) || take <= 0 || take > current.balanceAgorot) throw new TransitionError('Redemption amount is invalid.', 'guard')
      const balance = current.balanceAgorot - take
      if (to === 'PARTIALLY_REDEEMED' && balance === 0) throw new TransitionError('A fully used voucher is REDEEMED, not partially.', 'guard')
      if (to === 'REDEEMED' && balance !== 0) throw new TransitionError('REDEEMED needs the balance to reach zero.', 'guard')
      type = to === 'REDEEMED' ? 'REDEEMED' : 'REDEMPTION'
      amount = take
      patch.balanceAgorot = balance
      if (to === 'REDEEMED') patch.redeemedAt = now
      break
    }
    case 'CANCELLED': {
      if (current.balanceAgorot !== current.faceValueAgorot) throw new TransitionError('Only an untouched voucher (balance equal to face value) can be cancelled.', 'guard')
      // The supplier's own figure must agree: the admin route calls SupplierAdapter.checkBalance first.
      if (ctx.verifiedBalanceAgorot !== current.faceValueAgorot) throw new TransitionError('The supplier balance was not verified as untouched.', 'guard')
      const soldAt = current.soldAt?.toMillis()
      if (soldAt === undefined || now.toMillis() - soldAt > CANCELLATION_WINDOW_DAYS * DAY_MS) throw new TransitionError(`Cancellation is open for ${CANCELLATION_WINDOW_DAYS} days from the purchase.`, 'guard')
      type = 'CANCELLED'
      break
    }
    case 'EXPIRED':
      if (!current.expiresAt || current.expiresAt.toMillis() > now.toMillis()) throw new TransitionError('The voucher has not reached its expiry.', 'guard')
      type = 'EXPIRED'
      break
    case 'VOID':
      if (!ctx.reason?.trim() || !ctx.actor?.trim()) throw new TransitionError('A void needs a reason and an actor.', 'missing_meta')
      type = 'VOID'
      patch.reservedUntil = null
      patch.reservedForOrderId = null
      break
    default:
      throw new TransitionError(`Unknown status ${String(to)}.`)
  }
  const next = { ...current, ...patch } as VoucherState
  return {
    from, to, patch, next,
    event: { type, amountAgorot: amount, source: ctx.source ?? 'system', externalEventId: ctx.externalEventId ?? null, meta, businessId: ctx.businessId ?? null },
  }
}

/** The event document id: the supplier's own id when there is one (so a replay collides), else random. */
export function eventRefFor(db: Firestore, supplierId: SupplierId, externalEventId: string | null | undefined): DocumentReference {
  const col = db.collection(EVENTS_COLLECTION)
  return externalEventId ? col.doc(`${supplierId}_${externalEventId}`.replace(/[/\s]/g, '_').slice(0, 200)) : col.doc()
}

/**
 * Writes a plan's patch and event. Writes only: the caller read the voucher (and any event doc) first.
 * The event is `tx.create`d, never updated: voucherEvents is append-only.
 */
export function commitPlan(db: Firestore, tx: Transaction, voucherRef: DocumentReference, supplierId: SupplierId, plan: TransitionPlan, now: Timestamp, eventRef?: DocumentReference) {
  tx.update(voucherRef, plan.patch)
  tx.create(eventRef ?? eventRefFor(db, supplierId, plan.event.externalEventId), {
    voucherId: voucherRef.id, type: plan.event.type, fromStatus: plan.from, toStatus: plan.to, amountAgorot: plan.event.amountAgorot,
    businessId: plan.event.businessId, source: plan.event.source, externalEventId: plan.event.externalEventId, occurredAt: now, meta: plan.event.meta,
  })
}

export interface TransitionResult { voucher: VoucherState; plan: TransitionPlan; duplicate: boolean }

/**
 * A single status change in its own transaction: read, validate, write the new status and its event atomically.
 * A repeated `externalEventId` is a no-op that returns `duplicate: true`.
 */
export async function transitionVoucherStatus(db: Firestore, voucherId: string, to: InventoryStatus, ctx: TransitionContext = {}): Promise<TransitionResult> {
  const ref = db.collection(VOUCHERS_COLLECTION).doc(voucherId)
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref)
    if (!snap.exists) throw new TransitionError('Voucher not found.', 'not_found')
    const current = snap.data() as VoucherState
    const eventRef = eventRefFor(db, current.supplierId, ctx.externalEventId)
    if (ctx.externalEventId && (await tx.get(eventRef)).exists) return { voucher: current, plan: null as unknown as TransitionPlan, duplicate: true }
    const now = ctx.now ?? Timestamp.now()
    const plan = planTransition(current, to, { ...ctx, now })
    commitPlan(db, tx, ref, current.supplierId, plan, now, eventRef)
    return { voucher: plan.next, plan, duplicate: false }
  })
}

/**
 * A balance correction that is not a redemption (the supplier reports a different figure). The only legitimate way to change
 * `balanceAgorot` outside a transition, and it always leaves an ADJUSTMENT event with its reason and actor.
 */
export async function adjustVoucherBalance(db: Firestore, voucherId: string, newBalanceAgorot: number, ctx: Pick<TransitionContext, 'reason' | 'actor' | 'now' | 'externalEventId' | 'source'>): Promise<void> {
  if (!ctx.reason?.trim() || !ctx.actor?.trim()) throw new TransitionError('An adjustment needs a reason and an actor.', 'missing_meta')
  const ref = db.collection(VOUCHERS_COLLECTION).doc(voucherId)
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref)
    if (!snap.exists) throw new TransitionError('Voucher not found.', 'not_found')
    const current = snap.data() as VoucherState
    if (isTerminal(current.status)) throw new TransitionError('A finished voucher cannot be adjusted.')
    if (!Number.isInteger(newBalanceAgorot) || newBalanceAgorot < 0 || newBalanceAgorot > current.faceValueAgorot) throw new TransitionError('Balance is out of range.', 'guard')
    const eventRef = eventRefFor(db, current.supplierId, ctx.externalEventId)
    if (ctx.externalEventId && (await tx.get(eventRef)).exists) return
    const now = ctx.now ?? Timestamp.now()
    tx.update(ref, { balanceAgorot: newBalanceAgorot, updatedAt: now })
    tx.create(eventRef, {
      voucherId, type: 'ADJUSTMENT', fromStatus: current.status, toStatus: current.status, amountAgorot: newBalanceAgorot - current.balanceAgorot,
      businessId: null, source: ctx.source ?? 'manual', externalEventId: ctx.externalEventId ?? null, occurredAt: now,
      meta: { reason: ctx.reason, actor: ctx.actor, before: current.balanceAgorot, after: newBalanceAgorot },
    })
  })
}

// ---- Creation. A voucher is born in exactly two ways, both here so `status` is only ever written in this file. ----

export interface NewVoucherInput {
  productId: string
  supplierId: SupplierId
  codeEncrypted: string
  codeHash: string
  faceValueAgorot: number
  importBatchId?: string | null
  supplierRef?: string | null
  expiresAt?: Timestamp | null
}

/** A code staged by an import (STAGED), waiting for the batch approval. */
export function stagedVoucherData(input: NewVoucherInput, now: Timestamp): DocumentData {
  return {
    productId: input.productId, supplierId: input.supplierId, codeEncrypted: input.codeEncrypted, codeHash: input.codeHash, status: 'STAGED',
    faceValueAgorot: input.faceValueAgorot, balanceAgorot: input.faceValueAgorot, expiresAt: input.expiresAt ?? null, importBatchId: input.importBatchId ?? null,
    orderItemId: null, supplierRef: input.supplierRef ?? null, reservedUntil: null, reservedForOrderId: null, soldAt: null, createdAt: now, updatedAt: now,
  }
}

/**
 * A voucher the supplier issued at the sale (Multipass): created already DELIVERED, with its ISSUED, SOLD and DELIVERED events,
 * inside the settlement transaction. `external` is the supplier's own id for the code, which also keys the events.
 */
export function issuedVoucherPlan(db: Firestore, input: NewVoucherInput & { orderId: string; walletVoucherId: string; businessId?: string | null; externalId: string }, now: Timestamp) {
  const expiresAt = Timestamp.fromMillis(Math.min(input.expiresAt?.toMillis() ?? Infinity, addYearsEndOfIsraelDayMs(now.toMillis(), VOUCHER_VALIDITY_YEARS)))
  const data: DocumentData = {
    ...stagedVoucherData({ ...input, expiresAt }, now), status: 'DELIVERED', orderItemId: input.orderId, soldAt: now,
  }
  const steps: { type: VoucherEventType; from: InventoryStatus | null; to: InventoryStatus; amountAgorot: number }[] = [
    { type: 'ISSUED', from: null, to: 'SOLD', amountAgorot: input.faceValueAgorot },
    { type: 'DELIVERED', from: 'SOLD', to: 'DELIVERED', amountAgorot: 0 },
  ]
  const events = steps.map((s, i) => ({
    ref: eventRefFor(db, input.supplierId, `${input.externalId}:${s.type}`),
    data: {
      voucherId: input.codeHash, type: s.type, fromStatus: s.from, toStatus: s.to, amountAgorot: s.amountAgorot, businessId: input.businessId ?? null,
      source: input.supplierId === 'multipass' ? 'multipass' : 'system', externalEventId: `${input.externalId}:${s.type}`, occurredAt: now,
      meta: { orderId: input.orderId, walletVoucherId: input.walletVoucherId, step: i },
    } satisfies DocumentData,
  }))
  return { ref: db.collection(VOUCHERS_COLLECTION).doc(input.codeHash), data, events }
}

/** A code carried over from a legacy couponPools item, born in the status it already had (the backfill; see migratePools.ts). */
export function carriedVoucherData(input: NewVoucherInput & { status: Extract<InventoryStatus, 'IN_STOCK' | 'DELIVERED' | 'REDEEMED' | 'EXPIRED'>; soldAt?: Timestamp | null; orderItemId?: string | null }, now: Timestamp): DocumentData {
  return {
    ...stagedVoucherData(input, now), status: input.status, soldAt: input.soldAt ?? null, orderItemId: input.orderItemId ?? null,
    balanceAgorot: input.status === 'REDEEMED' ? 0 : input.faceValueAgorot,
  }
}

/** A clearly fake, unsold code for the dev payment sandbox (lib/payments/sandboxDemoStock.ts): born IN_STOCK, in no import batch. */
export function sandboxDemoVoucherData(input: NewVoucherInput, now: Timestamp): Record<string, unknown> {
  return carriedVoucherData({ ...input, status: 'IN_STOCK', soldAt: null, orderItemId: null, importBatchId: 'sandbox-demo' }, now)
}

/** The patch for a code that was IN_STOCK when copied and was sold by the older path in the meantime (migration catch-up only). */
export function ledgerCarry(status: InventoryStatus, orderId: string | null, soldAt: Timestamp, now: Timestamp, faceValueAgorot: number): Record<string, unknown> {
  return { status, soldAt, orderItemId: orderId, balanceAgorot: status === 'REDEEMED' ? 0 : faceValueAgorot, updatedAt: now }
}

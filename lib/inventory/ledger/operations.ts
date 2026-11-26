import 'server-only'
import { FieldValue, Timestamp, type Firestore } from 'firebase-admin/firestore'
import { parseVoucherStatus } from '@/lib/vouchers/status'
import { PaymentError } from '@/lib/payments/paymentValidation'
import { getSupplierAdapter } from '../suppliers'
import { SupplierNotConfiguredError, SupplierUnsupportedError } from '../suppliers/SupplierAdapter'
import { trackSupplierCall } from './alerts'
import { decryptVoucherCode } from './codes'
import { commitPlan, eventRefFor, planTransition, transitionVoucherStatus, TransitionError, type VoucherState } from './transitions'
import { VOUCHERS_COLLECTION } from './types'

// Admin and member operations that are only ever a transition plus a guard. None writes `status` itself.

/** Maps a ledger refusal to the HTTP error the routes return. */
export function toHttpError(error: unknown): PaymentError | null {
  if (error instanceof TransitionError) return new PaymentError(error.message, error.code === 'not_found' ? 404 : error.code === 'missing_meta' ? 400 : 409)
  return null
}

/**
 * Admin cancellation: within 14 days of the purchase, only an untouched voucher (balance === face value), and only after the
 * supplier's own balance was asked for (SupplierAdapter.checkBalance). It becomes CANCELLED and does NOT return to stock:
 * that needs `confirmSupplierVoid` once the supplier has voided the code.
 */
export async function cancelVoucher(db: Firestore, voucherId: string, actor: string, reason: string, now: Timestamp = Timestamp.now()) {
  const snap = await db.collection(VOUCHERS_COLLECTION).doc(voucherId).get()
  if (!snap.exists) throw new PaymentError('Voucher not found.', 404)
  const v = snap.data() as VoucherState & { codeEncrypted: string; supplierRef?: string | null }
  let verified: number | null
  try {
    const adapter = getSupplierAdapter(v.supplierId)
    const result = await trackSupplierCall(db, v.supplierId, () => adapter.checkBalance({ supplierRef: v.supplierRef ?? undefined, code: v.supplierId === 'multipass' ? decryptVoucherCode(v.codeEncrypted, voucherId) : undefined, ledgerBalanceAgorot: v.balanceAgorot }))
    verified = result.balanceAgorot
  } catch (error) {
    if (error instanceof SupplierNotConfiguredError || error instanceof SupplierUnsupportedError) throw new PaymentError('The supplier balance could not be checked, so the voucher cannot be cancelled.', 503)
    throw new PaymentError('The supplier balance check failed. Try again shortly.', 503)
  }
  if (verified === null) throw new PaymentError('The supplier did not report a balance.', 503)
  try {
    await transitionVoucherStatus(db, voucherId, 'CANCELLED', { actor, reason, source: 'manual', verifiedBalanceAgorot: verified, now })
  } catch (error) {
    throw toHttpError(error) ?? error
  }
}

/** CANCELLED -> IN_STOCK, only after the supplier confirmed the void (Raayonit: by hand; Multipass: voidCode). */
export async function confirmSupplierVoid(db: Firestore, voucherId: string, actor: string, reason: string) {
  try {
    await transitionVoucherStatus(db, voucherId, 'IN_STOCK', { actor, reason, source: 'manual', supplierVoidConfirmed: true })
  } catch (error) {
    throw toHttpError(error) ?? error
  }
}

export async function voidVoucher(db: Firestore, voucherId: string, actor: string, reason: string) {
  try {
    await transitionVoucherStatus(db, voucherId, 'VOID', { actor, reason, source: 'manual' })
  } catch (error) {
    throw toHttpError(error) ?? error
  }
}

/** The daily expiry job: IN_STOCK / DELIVERED / PARTIALLY_REDEEMED past `expiresAt` become EXPIRED (terminal). */
export async function expireDueVouchers(db: Firestore, now: Timestamp = Timestamp.now(), limit = 500): Promise<number> {
  let expired = 0
  for (const status of ['IN_STOCK', 'DELIVERED', 'PARTIALLY_REDEEMED'] as const) {
    const due = await db.collection(VOUCHERS_COLLECTION).where('status', '==', status).where('expiresAt', '<=', now).limit(limit).get()
    for (const doc of due.docs) {
      try { await transitionVoucherStatus(db, doc.id, 'EXPIRED', { now, source: 'system' }); expired++ } catch (error) { if (!(error instanceof TransitionError)) throw error }
    }
  }
  return expired
}

/** A member marks their code-only voucher used (the wallet route): DELIVERED / PARTIALLY_REDEEMED -> REDEEMED for the rest of the balance. */
export async function selfReportRedeemed(db: Firestore, inventoryVoucherId: string, walletVoucherId: string): Promise<void> {
  try {
    await transitionVoucherStatus(db, inventoryVoucherId, 'REDEEMED', { source: 'manual', actor: 'member', reason: 'self_reported', walletVoucherId })
  } catch (error) {
    // Already finished or never in the ledger (a pre-ledger voucher): the wallet document stays the record.
    if (!(error instanceof TransitionError)) throw error
  }
}

export type MarkUsedOutcome = 'ok' | 'notFound' | 'notEligible' | 'expired'

/**
 * A member marks their own code-only wallet voucher used (/api/vouchers/[voucherId]/mark-used), in ONE transaction: the wallet
 * document becomes 'redeemed' and its ledger copy goes DELIVERED / PARTIALLY_REDEEMED -> REDEEMED with its event, or neither
 * changes. Nothing is committed on a failure, so the two can never drift apart.
 *  - A foreign or missing voucher reads as `notFound`; one that is not an active code-only voucher is `notEligible`.
 *  - A voucher past its `expiresAt` is `expired` and stays untouched (an expired voucher cannot be used, so it is not "used").
 *  - A voucher from before the ledger, or whose ledger copy is already finished, has nothing to transition: the wallet
 *    document alone is the record, as before.
 */
export async function markWalletVoucherUsed(db: Firestore, uid: string, walletVoucherId: string, now: Timestamp = Timestamp.now()): Promise<MarkUsedOutcome> {
  const walletRef = db.collection('vouchers').doc(walletVoucherId)
  return db.runTransaction(async (tx) => {
    const wallet = await tx.get(walletRef)
    const data = wallet.data()
    if (!data || data.userId !== uid) return 'notFound'
    if (data.redemptionKind !== 'code_only' || parseVoucherStatus(data.status) !== 'active') return 'notEligible'
    if (data.expiresAt instanceof Timestamp && data.expiresAt.toMillis() <= now.toMillis()) return 'expired'
    // Every read before the first write.
    const ledgerRef = typeof data.inventoryVoucherId === 'string' && data.inventoryVoucherId ? db.collection(VOUCHERS_COLLECTION).doc(data.inventoryVoucherId) : null
    const ledger = ledgerRef ? await tx.get(ledgerRef) : null
    let plan: ReturnType<typeof planTransition> | null = null
    if (ledgerRef && ledger?.exists) {
      const current = ledger.data() as VoucherState
      try {
        plan = planTransition(current, 'REDEEMED', { now, source: 'manual', actor: 'member', reason: 'self_reported', walletVoucherId })
      } catch (error) {
        // Already finished (or in a state that cannot redeem): nothing to move in the ledger.
        if (!(error instanceof TransitionError)) throw error
      }
      if (plan) commitPlan(db, tx, ledgerRef, current.supplierId, plan, now, eventRefFor(db, current.supplierId, null))
    }
    tx.update(walletRef, { status: 'redeemed', redeemedAt: now, selfReportedUse: true, updatedAt: FieldValue.serverTimestamp() })
    return 'ok'
  })
}

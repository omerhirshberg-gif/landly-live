import 'server-only'
import type { Firestore } from 'firebase-admin/firestore'
import { claimOfferForOrder } from './claimOfferForOrder'
import type { TranzilaNotification } from './parseTranzilaNotification'
import { PaymentError } from './paymentValidation'
import { assertMatchesExpected, getTranzilaVerifier, type TranzilaTransactionVerifier } from './verifyTranzilaTransaction'

export interface SettleResult { status: 'paid' | 'failed' | 'pending'; alreadyProcessed: boolean; approved: boolean }

// The single path from "Tranzila (maybe) charged this" to a voucher (webhook and /api/payments/confirm both use it).
// The settled event is built from what Tranzila's own record says, after it matches what the server froze on the order;
// the claim that triggered the call only says where to look. claimOfferForOrder then re-checks terminal, currency,
// amount and the receipt inside its transaction.
export async function settleClaimedTransaction(
  db: Firestore, claim: Pick<TranzilaNotification, 'orderId' | 'terminal' | 'tranzilaTxnId' | 'amountAgorot'>,
  verifier: TranzilaTransactionVerifier = getTranzilaVerifier(),
): Promise<SettleResult & { event: TranzilaNotification }> {
  const verified = await verifier.byTransactionId(claim.terminal, claim.tranzilaTxnId)
  // Tranzila does not know it (yet): 503 so Notify retries, never a settlement.
  if (!verified) throw new PaymentError('Transaction is not confirmed by Tranzila yet.', 503)
  const orderSnap = await db.collection('orders').doc(claim.orderId).get()
  const order = orderSnap.data()
  if (!order) throw new PaymentError('Order not found.', 404)
  assertMatchesExpected(verified, { orderId: claim.orderId, terminal: order.terminal, amountAgorot: order.amountAgorot, tranzilaTxnId: claim.tranzilaTxnId })
  // A notification that disagrees with Tranzila's own record is a conflict to reconcile, not something to settle either way.
  if (claim.amountAgorot !== verified.amountAgorot || claim.terminal !== verified.terminal) {
    throw new PaymentError('Notification does not match the Tranzila transaction; reconciliation is required.')
  }
  return settle(db, claim.orderId, verified)
}

/** For /confirm: asks Tranzila what it holds for this order. Nothing there yet reads as pending. */
export async function settleOrderById(
  db: Firestore, orderId: string, verifier: TranzilaTransactionVerifier = getTranzilaVerifier(),
): Promise<SettleResult & { event: TranzilaNotification | null }> {
  const order = (await db.collection('orders').doc(orderId).get()).data()
  if (!order) throw new PaymentError('Order not found.', 404)
  const verified = await verifier.byOrderId(order.terminal, orderId)
  if (!verified) return { status: 'pending', alreadyProcessed: false, approved: false, event: null }
  assertMatchesExpected(verified, { orderId, terminal: order.terminal, amountAgorot: order.amountAgorot })
  return settle(db, orderId, verified)
}

async function settle(db: Firestore, orderId: string, verified: Awaited<ReturnType<TranzilaTransactionVerifier['byTransactionId']>> & object) {
  const event: TranzilaNotification = {
    orderId, terminal: verified.terminal, tranzilaTxnId: verified.tranzilaTxnId, approved: verified.approved,
    responseCode: verified.approved ? '000' : verified.responseCode, amountAgorot: verified.amountAgorot, currency: 'ILS',
  }
  const { alreadyProcessed } = await claimOfferForOrder(db, event)
  return { status: event.approved ? 'paid' as const : 'failed' as const, alreadyProcessed, approved: event.approved, event }
}

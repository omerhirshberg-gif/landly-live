import 'server-only'
import type { Firestore } from 'firebase-admin/firestore'
import { claimOfferForOrder } from './claimOfferForOrder'
import type { TranzilaNotification } from './parseTranzilaNotification'
import { PaymentError } from './paymentValidation'
import { verifiedFromChargeResponse } from './responseHashVerifier'
import { assertMatchesExpected, getTranzilaVerifier, type TranzilaTransactionVerifier, type VerifiedTransaction } from './verifyTranzilaTransaction'

/**
 * paid      -- approved and the voucher issued (or already was)
 * declined  -- a retryable decline: the order stays pending so the member can try another card or wallet
 * failed    -- a final decline (the dev sandbox only)
 * pending   -- Tranzila holds nothing for the order yet
 */
export interface SettleResult {
  status: 'paid' | 'declined' | 'failed' | 'pending'
  alreadyProcessed: boolean
  approved: boolean
  event: TranzilaNotification | null
}

// The single path from "Tranzila (maybe) charged this" to a voucher; the Notify trigger and /api/payments/confirm both use it.
// Tranzila is asked what it holds for the ORDER (the order id and its frozen terminal and amount are ours), and the settled
// event is built from Tranzila's own record after it matches. claimOfferForOrder then re-checks terminal, currency, amount
// and the receipt inside its transaction. `expectedAmountAgorot` (from the signed notify URL) must also agree.
export async function settleOrderById(
  db: Firestore, orderId: string,
  { verifier = getTranzilaVerifier(), expectedAmountAgorot = null }: { verifier?: TranzilaTransactionVerifier; expectedAmountAgorot?: number | null } = {},
): Promise<SettleResult> {
  const order = (await db.collection('orders').doc(orderId).get()).data()
  if (!order) throw new PaymentError('Order not found.', 404)
  if (expectedAmountAgorot !== null && expectedAmountAgorot !== order.amountAgorot) {
    throw new PaymentError('Notification does not match the order; reconciliation is required.')
  }
  // Already settled (by this path, the confirmation or the signed response): acknowledge a repeat Notify without asking Tranzila
  // again, which also spares the report host's rate limit. Only a verified settlement ever sets `paid`.
  if (order.status === 'paid') return { status: 'paid', alreadyProcessed: true, approved: true, event: null }
  const verified = await verifier.byOrderId(order.terminal, orderId)
  if (!verified) return { status: 'pending', alreadyProcessed: false, approved: false, event: null }
  assertMatchesExpected(verified, { orderId, terminal: order.terminal, amountAgorot: order.amountAgorot })
  return settle(db, orderId, verified)
}

/**
 * response_hash mode: settle from the signed charge response the page or app forwarded. Nothing in it is trusted until its
 * hash verifies; the order, amount, currency and mode must then match what the server froze.
 */
export async function settleChargeResponse(
  db: Firestore, orderId: string, chargeResponse: unknown, secret: string | null,
): Promise<SettleResult> {
  const order = (await db.collection('orders').doc(orderId).get()).data()
  if (!order) throw new PaymentError('Order not found.', 404)
  const verified = verifiedFromChargeResponse(chargeResponse, { orderId, terminal: order.terminal, secret })
  assertMatchesExpected(verified, { orderId, terminal: order.terminal, amountAgorot: order.amountAgorot })
  // A response with no order id was refused above; one for another order never matches here.
  if (verified.orderId !== orderId) throw new PaymentError('Tranzila transaction does not match the order; reconciliation is required.')
  return settle(db, orderId, verified)
}

async function settle(db: Firestore, orderId: string, verified: VerifiedTransaction): Promise<SettleResult> {
  const event: TranzilaNotification = {
    orderId, terminal: verified.terminal, tranzilaTxnId: verified.tranzilaTxnId, approved: verified.approved,
    responseCode: verified.approved ? '000' : verified.responseCode, amountAgorot: verified.amountAgorot, currency: 'ILS',
  }
  const { alreadyProcessed, retryable = false } = await claimOfferForOrder(db, event)
  return {
    status: event.approved ? 'paid' : retryable ? 'declined' : 'failed',
    alreadyProcessed, approved: event.approved, event,
  }
}

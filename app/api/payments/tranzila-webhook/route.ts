import { NextResponse } from 'next/server'
import { getAdminDb } from '@/lib/firebase/admin'
import { verifyNotifyToken } from '@/lib/payments/notifyToken'
import { isTranzilaWebhookSecret } from '@/lib/payments/verifyWebhookSecret'
import { scheduleOrderConfirmation } from '@/lib/payments/orderConfirmation'
import { parseNotifyTrigger } from '@/lib/payments/parseNotifyTrigger'
import { PaymentError } from '@/lib/payments/paymentValidation'
import { settleOrderById } from '@/lib/payments/settleVerifiedPayment'
import { requireTranzilaConfig, TranzilaConfigError } from '@/lib/payments/tranzilaConfig'

// Notify is a TRIGGER (lib/payments/parseNotifyTrigger.ts): it says "look at this order", and the answer comes from
// Tranzila's own record, never from the body. Two gates, both before any database access, neither proof that Tranzila is
// the sender:
//  - the signed notify_url token (`t`), which binds the call to the order, terminal and amount the server froze, or
//  - the optional shared-secret header (a terminal that can send one).
// Authenticity comes from settleOrderById: the transaction is re-read from Tranzila (R2) and settles only if it matches the
// order. Until that lookup is confirmed with Tranzila the verifier is fail-closed: 503, nothing settled. A decline is
// acknowledged (OK) and leaves the order pending, so the member can retry.
export async function POST(request: Request) {
  const headerOk = isTranzilaWebhookSecret(request.headers.get('x-tranzila-webhook-secret'))
  if (!headerOk && !new URL(request.url).searchParams.get('t')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  try {
    const config = requireTranzilaConfig()
    const trigger = await parseNotifyTrigger(request)
    if (!headerOk && (trigger.amountAgorot === null
      || !verifyNotifyToken(trigger.token, { orderId: trigger.orderId, terminal: config.terminal, amountAgorot: trigger.amountAgorot }, config.webhookSecret))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const db = getAdminDb()
    try {
      const result = await settleOrderById(db, trigger.orderId, { expectedAmountAgorot: trigger.amountAgorot })
      // Tranzila's record is not there yet: 503 so Notify retries.
      if (result.status === 'pending') throw new PaymentError('Transaction is not confirmed by Tranzila yet.', 503)
      // Only a fresh approval emails the member; retries replay as alreadyProcessed.
      if (result.approved && !result.alreadyProcessed) scheduleOrderConfirmation(db, trigger.orderId)
    } catch (err) {
      // Preserve a minimal reconciliation reference, never raw card/token data.
      console.error('Payment settlement requires attention', {
        orderId: trigger.orderId, terminal: config.terminal,
        reason: err instanceof PaymentError ? err.message : 'Transaction could not commit',
      })
      throw err
    }
    // Tranzila's Notify guide expects a plain OK acknowledgement, including retries.
    return new Response('OK', { status: 200, headers: { 'Content-Type': 'text/plain' } })
  } catch (err) {
    if (err instanceof PaymentError) return NextResponse.json({ error: err.message }, { status: err.status })
    if (err instanceof TranzilaConfigError) {
      console.error('Payment configuration invalid:', err.message)
      return NextResponse.json({ error: 'Payment terminal is not configured.' }, { status: 503 })
    }
    return NextResponse.json({ error: 'Payment settlement could not complete. Retry required.' }, { status: 503 })
  }
}

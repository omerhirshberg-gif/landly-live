import { NextResponse } from 'next/server'
import { getAdminDb } from '@/lib/firebase/admin'
import { verifyNotifyToken } from '@/lib/payments/notifyToken'
import { isTranzilaWebhookSecret } from '@/lib/payments/verifyWebhookSecret'
import { scheduleOrderConfirmation } from '@/lib/payments/orderConfirmation'
import { parseHostedFieldsNotification } from '@/lib/payments/parseHostedFieldsNotification'
import { PaymentError } from '@/lib/payments/paymentValidation'
import { settleClaimedTransaction } from '@/lib/payments/settleVerifiedPayment'
import { requireTranzilaConfig, TranzilaConfigError } from '@/lib/payments/tranzilaConfig'

// Two gates, both before any database access, neither proof that Tranzila is the sender:
//  - the signed notify_url token (`t`), which binds the call to the order, terminal and amount the server froze, or
//  - the optional shared-secret header (a terminal that can send one).
// Authenticity comes from settleClaimedTransaction: the transaction is re-read from Tranzila (R2) and settles only if it
// matches the order. Until that lookup is confirmed with Tranzila the verifier is fail-closed: 503, nothing settled.
export async function POST(request: Request) {
  const headerOk = isTranzilaWebhookSecret(request.headers.get('x-tranzila-webhook-secret'))
  if (!headerOk && !new URL(request.url).searchParams.get('t')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  try {
    const config = requireTranzilaConfig()
    const { event: claim, token } = await parseHostedFieldsNotification(request, config.terminal)
    if (!headerOk && !verifyNotifyToken(token, claim, config.webhookSecret)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const db = getAdminDb()
    try {
      const { event, alreadyProcessed } = await settleClaimedTransaction(db, claim)
      // Only a fresh approval emails the member; retries replay as alreadyProcessed.
      if (event.approved && !alreadyProcessed) scheduleOrderConfirmation(db, event.orderId)
    } catch (err) {
      // Preserve a minimal reconciliation reference, never raw card/token data.
      console.error('Payment settlement requires attention', {
        orderId: claim.orderId, terminal: claim.terminal, transactionId: claim.tranzilaTxnId,
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

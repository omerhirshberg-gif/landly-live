import { NextResponse } from 'next/server'
import { getAdminDb } from '@/lib/firebase/admin'
import { isTranzilaWebhookSecret } from '@/lib/payments/verifyWebhookSecret'
import { claimOfferForOrder } from '@/lib/payments/claimOfferForOrder'
import { scheduleOrderConfirmation } from '@/lib/payments/orderConfirmation'
import { parseTranzilaNotification } from '@/lib/payments/parseTranzilaNotification'
import { paymentTerminal, PaymentError } from '@/lib/payments/paymentValidation'

// IMPORTANT: custom shared-secret authentication is retained fail-closed.
// Confirm actual Tranzila notification authentication/transport with support
// before enabling payments; QSTR parsing alone does not authenticate a sender.
export async function POST(request: Request) {
  if (!isTranzilaWebhookSecret(request.headers.get('x-tranzila-webhook-secret'))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  try {
    const event = await parseTranzilaNotification(request, paymentTerminal())
    const db = getAdminDb()
    try {
      const { alreadyProcessed } = await claimOfferForOrder(db, event)
      // Only a fresh approval emails the member; retries replay as alreadyProcessed.
      if (event.approved && !alreadyProcessed) scheduleOrderConfirmation(db, event.orderId)
    } catch (err) {
      // Preserve a minimal reconciliation reference, never raw card/token data.
      console.error('Payment settlement requires attention', {
        orderId: event.orderId, terminal: event.terminal, transactionId: event.tranzilaTxnId,
        reason: err instanceof PaymentError ? err.message : 'Transaction could not commit',
      })
      throw err
    }
    // Tranzila's Notify guide expects a plain OK acknowledgement, including retries.
    return new Response('OK', { status: 200, headers: { 'Content-Type': 'text/plain' } })
  } catch (err) {
    if (err instanceof PaymentError) return NextResponse.json({ error: err.message }, { status: err.status })
    return NextResponse.json({ error: 'Payment settlement could not complete. Retry required.' }, { status: 503 })
  }
}

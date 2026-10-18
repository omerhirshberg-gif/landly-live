import { corsHeaders } from '@/lib/auth/cors'
import { checkUidRateLimit } from '@/lib/auth/uidRateLimit'
import { NextResponse } from 'next/server'
import { getAdminDb } from '@/lib/firebase/admin'
import { requireVerifiedCustomerUid, RequestAuthError } from '@/lib/firebase/verifyRequestUser'
import { claimOfferForOrder } from '@/lib/payments/claimOfferForOrder'
import { scheduleOrderConfirmation } from '@/lib/payments/orderConfirmation'
import { DEV_SANDBOX_TERMINAL, isPaymentSandboxEnabled, sandboxTransactionId } from '@/lib/payments/devSandbox'
import { isDocumentId, PaymentError } from '@/lib/payments/paymentValidation'

// Local development only (lib/payments/devSandbox.ts): stands in for the
// Tranzila notification so a sandbox order settles through the webhook's own
// claimOfferForOrder transaction. Anywhere else this route doesn't exist.
// CORS for the app's Expo web build (lib/auth/cors.ts).
export function OPTIONS(request: Request) {
  if (!isPaymentSandboxEnabled()) return new NextResponse(null, { status: 404 })
  return new NextResponse(null, { status: 204, headers: corsHeaders(request) })
}

export async function POST(request: Request) {
  if (!isPaymentSandboxEnabled()) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const cors = corsHeaders(request)
  const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: cors })
  try {
    const uid = await requireVerifiedCustomerUid(request)
    const limited = checkUidRateLimit('payment', uid)
    if (limited) {
      for (const [name, value] of Object.entries(cors)) limited.headers.set(name, value)
      return limited
    }
    const body = await request.json().catch(() => null)
    if (!isDocumentId(body?.orderId)) return json({ error: 'Invalid orderId.' }, 400)
    if (body.outcome !== 'approve' && body.outcome !== 'decline') {
      return json({ error: 'Invalid outcome.' }, 400)
    }
    const db = getAdminDb()
    const orderSnap = await db.collection('orders').doc(body.orderId).get()
    const order = orderSnap.data()
    // Someone else's order reads as missing.
    if (!order || order.userId !== uid) throw new PaymentError('Order not found.', 404)
    if (order.terminal !== DEV_SANDBOX_TERMINAL) throw new PaymentError('Not a sandbox order.', 409)
    if (order.status !== 'pending') throw new PaymentError('Order is already settled.', 409)
    const approved = body.outcome === 'approve'
    const { alreadyProcessed } = await claimOfferForOrder(db, {
      orderId: body.orderId, terminal: DEV_SANDBOX_TERMINAL, tranzilaTxnId: sandboxTransactionId(),
      approved, responseCode: approved ? '000' : '004',
      amountAgorot: order.amountAgorot, currency: 'ILS',
    })
    // Without Resend credentials this writes a local preview instead (lib/payments/orderConfirmation.ts).
    if (approved && !alreadyProcessed) scheduleOrderConfirmation(db, body.orderId)
    return json({ orderId: body.orderId })
  } catch (err) {
    if (err instanceof PaymentError || err instanceof RequestAuthError) return json({ error: err.message }, err.status)
    console.error('Sandbox payment failed', err)
    return json({ error: 'Sandbox payment could not complete.' }, 503)
  }
}

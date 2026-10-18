import { checkUidRateLimit } from '@/lib/auth/uidRateLimit'
import { NextResponse } from 'next/server'
import { getAdminDb } from '@/lib/firebase/admin'
import { requireVerifiedCustomerUid, RequestAuthError } from '@/lib/firebase/verifyRequestUser'
import { claimOfferForOrder } from '@/lib/payments/claimOfferForOrder'
import { DEV_SANDBOX_TERMINAL, isPaymentSandboxEnabled, sandboxTransactionId } from '@/lib/payments/devSandbox'
import { isDocumentId, PaymentError } from '@/lib/payments/paymentValidation'

// Local development only (lib/payments/devSandbox.ts): stands in for the
// Tranzila notification so a sandbox order settles through the webhook's own
// claimOfferForOrder transaction. Anywhere else this route doesn't exist.
export async function POST(request: Request) {
  if (!isPaymentSandboxEnabled()) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  try {
    const uid = await requireVerifiedCustomerUid(request)
    const limited = checkUidRateLimit('payment', uid)
    if (limited) return limited
    const body = await request.json().catch(() => null)
    if (!isDocumentId(body?.orderId)) return NextResponse.json({ error: 'Invalid orderId.' }, { status: 400 })
    if (body.outcome !== 'approve' && body.outcome !== 'decline') {
      return NextResponse.json({ error: 'Invalid outcome.' }, { status: 400 })
    }
    const db = getAdminDb()
    const orderSnap = await db.collection('orders').doc(body.orderId).get()
    const order = orderSnap.data()
    // Someone else's order reads as missing.
    if (!order || order.userId !== uid) throw new PaymentError('Order not found.', 404)
    if (order.terminal !== DEV_SANDBOX_TERMINAL) throw new PaymentError('Not a sandbox order.', 409)
    if (order.status !== 'pending') throw new PaymentError('Order is already settled.', 409)
    const approved = body.outcome === 'approve'
    await claimOfferForOrder(db, {
      orderId: body.orderId, terminal: DEV_SANDBOX_TERMINAL, tranzilaTxnId: sandboxTransactionId(),
      approved, responseCode: approved ? '000' : '004',
      amountAgorot: order.amountAgorot, currency: 'ILS',
    })
    return NextResponse.json({ orderId: body.orderId })
  } catch (err) {
    if (err instanceof PaymentError || err instanceof RequestAuthError) return NextResponse.json({ error: err.message }, { status: err.status })
    console.error('Sandbox payment failed', err)
    return NextResponse.json({ error: 'Sandbox payment could not complete.' }, { status: 503 })
  }
}

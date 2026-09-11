import { NextResponse } from 'next/server'
import { Timestamp } from 'firebase-admin/firestore'
import { getAdminDb } from '@/lib/firebase/admin'
import { isTranzilaWebhookSecret } from '@/lib/payments/verifyWebhookSecret'
import { claimOfferForOrder, ClaimOfferError } from '@/lib/payments/claimOfferForOrder'

// Server-to-server callback Tranzila will call once real credentials exist —
// the exact payload shape below is a placeholder (mirrors how
// TranzilaPaymentWidget is a placeholder UI today) and should be adjusted
// once Tranzila's actual notify-URL format and signature scheme are known.
// The security property that matters right now, and won't need to change,
// is: a voucher is only ever created here, server-side, after this route
// independently confirms payment — never from a client request.
interface WebhookBody {
  orderId: string
  success: boolean
  amount: number
  tranzilaTxnId: string
}

function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 })
}

export async function POST(request: Request) {
  const secret = request.headers.get('x-tranzila-webhook-secret')
  if (!isTranzilaWebhookSecret(secret)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = (await request.json().catch(() => null)) as WebhookBody | null
  if (!body?.orderId || typeof body.orderId !== 'string') return badRequest('Missing orderId.')

  const adminDb = getAdminDb()
  const orderRef = adminDb.collection('orders').doc(body.orderId)
  const orderSnap = await orderRef.get()
  if (!orderSnap.exists) return NextResponse.json({ error: 'Order not found.' }, { status: 404 })
  const order = orderSnap.data()!

  // Retried notifications are a normal part of webhook delivery — treat an
  // already-settled order as a successful no-op rather than erroring or
  // double-claiming.
  if (order.status === 'paid' || order.status === 'failed') {
    return NextResponse.json({ ok: true, alreadyProcessed: true })
  }

  if (!body.success) {
    await orderRef.update({ status: 'failed' })
    return NextResponse.json({ ok: true })
  }

  const expectedAmount = Number(order.amount) || 0
  if (Number(body.amount) !== expectedAmount) {
    return badRequest('Payment amount does not match the order amount.')
  }

  try {
    const { voucherId } = await claimOfferForOrder(adminDb, {
      uid: order.userId,
      offerId: order.offerId,
      businessId: order.businessId,
      businessName: order.businessName,
      offerTitle: order.offerTitle,
    })

    await orderRef.update({
      status: 'paid',
      paidAt: Timestamp.now(),
      tranzilaTxnId: body.tranzilaTxnId ?? null,
      voucherId,
    })
  } catch (err) {
    if (err instanceof ClaimOfferError) {
      await orderRef.update({ status: 'failed' })
      return NextResponse.json({ error: err.message }, { status: 409 })
    }
    throw err
  }

  return NextResponse.json({ ok: true })
}

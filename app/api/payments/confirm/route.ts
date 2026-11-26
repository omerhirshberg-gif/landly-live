import { corsHeaders } from '@/lib/auth/cors'
import { checkUidRateLimit } from '@/lib/auth/uidRateLimit'
import { NextResponse } from 'next/server'
import { getAdminDb } from '@/lib/firebase/admin'
import { requireVerifiedCustomerUid, RequestAuthError } from '@/lib/firebase/verifyRequestUser'
import { DEV_SANDBOX_TERMINAL } from '@/lib/payments/devSandbox'
import { scheduleOrderConfirmation } from '@/lib/payments/orderConfirmation'
import { isDocumentId, PaymentError } from '@/lib/payments/paymentValidation'
import { settleOrderById } from '@/lib/payments/settleVerifiedPayment'
import { requireTranzilaConfig, TranzilaConfigError } from '@/lib/payments/tranzilaConfig'
import { errorBody } from '@/lib/api/errorCode'

// After Hosted Fields reports a charge, the page or app asks the server to settle. The request carries nothing but the
// order id: no card data, amount or transaction id from the client. The server asks Tranzila what it holds for the order
// (lib/payments/verifyTranzilaTransaction.ts, fail-closed) and settles through the same transaction as the webhook, so a
// Notify arriving first, second or twice converges on one settlement. Nothing there yet answers 202 "pending".
export function OPTIONS(request: Request) {
  return new NextResponse(null, { status: 204, headers: corsHeaders(request) })
}

export async function POST(request: Request) {
  const cors = corsHeaders(request)
  const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: cors })
  try {
    const uid = await requireVerifiedCustomerUid(request)
    const limited = await checkUidRateLimit('payment', uid)
    if (limited) {
      for (const [name, value] of Object.entries(cors)) limited.headers.set(name, value)
      return limited
    }
    const body = await request.json().catch(() => null)
    if (!isDocumentId(body?.orderId)) return json(errorBody('Invalid orderId.', 400), 400)
    const db = getAdminDb()
    const order = (await db.collection('orders').doc(body.orderId).get()).data()
    // Someone else's order reads as missing.
    if (!order || order.userId !== uid) throw new PaymentError('Order not found.', 404)
    if (order.terminal === DEV_SANDBOX_TERMINAL) throw new PaymentError('Not a live order.', 409)
    if (order.status === 'paid' || order.status === 'failed') return json({ orderId: body.orderId, status: order.status })
    requireTranzilaConfig()
    const result = await settleOrderById(db, body.orderId)
    if (result.approved && !result.alreadyProcessed) scheduleOrderConfirmation(db, body.orderId)
    return json({ orderId: body.orderId, status: result.status }, result.status === 'pending' ? 202 : 200)
  } catch (err) {
    if (err instanceof PaymentError || err instanceof RequestAuthError) {
      if (err.status >= 500) console.error('Payment confirmation refused:', err.status, err.message)
      return json(errorBody(err.message, err.status), err.status)
    }
    if (err instanceof TranzilaConfigError) {
      console.error('Payment configuration invalid:', err.message)
      return json(errorBody('Payment terminal is not configured.', 503), 503)
    }
    console.error('Payment confirmation failed:', err instanceof Error ? `${err.name}: ${err.message}` : 'unknown error')
    return json(errorBody('Could not confirm payment.', 503), 503)
  }
}

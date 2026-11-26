import { orderIdFor } from '@/lib/offers/variants'
import { corsHeaders } from '@/lib/auth/cors'
import { checkUidRateLimit } from '@/lib/auth/uidRateLimit'
import { NextResponse } from 'next/server'
import { getAdminDb } from '@/lib/firebase/admin'
import { requireVerifiedCustomerUid, RequestAuthError } from '@/lib/firebase/verifyRequestUser'
import { DEV_SANDBOX_TERMINAL } from '@/lib/payments/devSandbox'
import { initiateOrder } from '@/lib/payments/initiateOrder'
import { checkoutTerminal, isDocumentId, PaymentError } from '@/lib/payments/paymentValidation'
import { errorBody } from '@/lib/api/errorCode'
import { issueHostedPayment } from '@/lib/payments/hostedPayment'
import { requireTranzilaConfig, TranzilaConfigError } from '@/lib/payments/tranzilaConfig'

// Called same-origin by the website's checkout and cross-origin by the app's
// native checkout screen; CORS for its Expo web build (lib/auth/cors.ts).
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
    if (!isDocumentId(body?.offerId)) return json(errorBody('Invalid offerId.', 400), 400)
    const variantPoolId = isDocumentId(body?.variantPoolId) ? body.variantPoolId : null
    const terminal = checkoutTerminal()
    const db = getAdminDb()
    if (terminal !== DEV_SANDBOX_TERMINAL) {
      // All-or-nothing credentials (lib/payments/tranzilaConfig.ts): a half-configured terminal is a 503, never a half-working checkout.
      const config = requireTranzilaConfig()
      const order = await initiateOrder(db, uid, body.offerId, terminal, { acceptTerms: body.acceptTerms === true, variantPoolId })
      // The Handshake (thtk) is requested only from the Pay tap, once the terms are accepted: a page view never reaches Tranzila.
      const payment = body.acceptTerms === true ? await issueHostedPayment(db, order, config) : null
      return json({ ...order, sandbox: false, resumed: false, payment })
    }
    // Local dev sandbox: stale test orders are replaced instead of blocking
    // checkout, and `restart` discards an unfinished one on request.
    const restart = body.restart === true
    const previousId = orderIdFor(uid, body.offerId, variantPoolId)
    const previous = isDocumentId(previousId)
      ? (await db.collection('orders').doc(previousId).get()).data()
      : undefined
    const order = await initiateOrder(db, uid, body.offerId, terminal, { acceptTerms: body.acceptTerms === true, sandbox: { restart }, variantPoolId })
    const resumed = !restart && previous?.status === 'pending' && previous.terminal === DEV_SANDBOX_TERMINAL
    return json({ ...order, sandbox: true, resumed, payment: null })
  } catch (err) {
    if (err instanceof PaymentError || err instanceof RequestAuthError) {
      // Name the cause for Vercel Runtime Logs; 5xx all read alike to the member.
      if (err.status >= 500) console.error('Payment initiation refused:', err.status, err.message)
      return json(errorBody(err.message, err.status), err.status)
    }
    if (err instanceof TranzilaConfigError) {
      console.error('Payment configuration invalid:', err.message)
      return json(errorBody('Payment terminal is not configured.', 503), 503)
    }
    // Error text only: never the request, token or credentials.
    console.error('Payment initiation failed:', err instanceof Error ? `${err.name}: ${err.message}` : 'unknown error')
    return json(errorBody('Could not initiate payment.', 503), 503)
  }
}

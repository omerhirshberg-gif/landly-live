import { corsHeaders } from '@/lib/auth/cors'
import { checkUidRateLimit } from '@/lib/auth/uidRateLimit'
import { NextResponse } from 'next/server'
import { getAdminDb } from '@/lib/firebase/admin'
import { requireVerifiedCustomerUid, RequestAuthError } from '@/lib/firebase/verifyRequestUser'
import { DEV_SANDBOX_TERMINAL } from '@/lib/payments/devSandbox'
import { initiateOrder } from '@/lib/payments/initiateOrder'
import { checkoutTerminal, isDocumentId, PaymentError } from '@/lib/payments/paymentValidation'

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
    const limited = checkUidRateLimit('payment', uid)
    if (limited) {
      for (const [name, value] of Object.entries(cors)) limited.headers.set(name, value)
      return limited
    }
    const body = await request.json().catch(() => null)
    if (!isDocumentId(body?.offerId)) return json({ error: 'Invalid offerId.' }, 400)
    const terminal = checkoutTerminal()
    const db = getAdminDb()
    if (terminal !== DEV_SANDBOX_TERMINAL) {
      const order = await initiateOrder(db, uid, body.offerId, terminal, { acceptTerms: body.acceptTerms === true })
      return json({ ...order, sandbox: false, resumed: false })
    }
    // Local dev sandbox: stale test orders are replaced instead of blocking
    // checkout, and `restart` discards an unfinished one on request.
    const restart = body.restart === true
    const previous = isDocumentId(`${uid}_${body.offerId}`)
      ? (await db.collection('orders').doc(`${uid}_${body.offerId}`).get()).data()
      : undefined
    const order = await initiateOrder(db, uid, body.offerId, terminal, { acceptTerms: body.acceptTerms === true, sandbox: { restart } })
    const resumed = !restart && previous?.status === 'pending' && previous.terminal === DEV_SANDBOX_TERMINAL
    return json({ ...order, sandbox: true, resumed })
  } catch (err) {
    if (err instanceof PaymentError || err instanceof RequestAuthError) return json({ error: err.message }, err.status)
    console.error('Payment initiation failed')
    return json({ error: 'Could not initiate payment.' }, 503)
  }
}

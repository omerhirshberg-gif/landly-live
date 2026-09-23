import { checkUidRateLimit } from '@/lib/auth/uidRateLimit'
import { NextResponse } from 'next/server'
import { getAdminDb } from '@/lib/firebase/admin'
import { requireVerifiedCustomerUid, RequestAuthError } from '@/lib/firebase/verifyRequestUser'
import { initiateOrder } from '@/lib/payments/initiateOrder'
import { isDocumentId, paymentTerminal, PaymentError } from '@/lib/payments/paymentValidation'

export async function POST(request: Request) {
  try {
    const uid = await requireVerifiedCustomerUid(request)
    const limited = checkUidRateLimit('payment', uid)
    if (limited) return limited
    const body = await request.json().catch(() => null)
    if (!isDocumentId(body?.offerId)) return NextResponse.json({ error: 'Invalid offerId.' }, { status: 400 })
    const terminal = paymentTerminal()
    return NextResponse.json(await initiateOrder(getAdminDb(), uid, body.offerId, terminal))
  } catch (err) {
    if (err instanceof PaymentError || err instanceof RequestAuthError) return NextResponse.json({ error: err.message }, { status: err.status })
    console.error('Payment initiation failed')
    return NextResponse.json({ error: 'Could not initiate payment.' }, { status: 503 })
  }
}

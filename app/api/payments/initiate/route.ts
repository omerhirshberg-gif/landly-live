import { NextResponse } from 'next/server'
import { Timestamp } from 'firebase-admin/firestore'
import { isOfferActive } from '@/lib/admin/offerStatus'
import { getAdminDb } from '@/lib/firebase/admin'
import { getUidFromRequest } from '@/lib/firebase/verifyRequestUser'

interface RequestBody {
  offerId: string
}

function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 })
}

// Creates (or refreshes) a pending order for one offer, priced at that
// offer's current offerPrice. The checkout page calls this on load and
// hands the returned orderId/amount to TranzilaPaymentWidget — the real
// voucher only gets created later, by app/api/payments/tranzila-webhook,
// once payment for this exact order is confirmed.
export async function POST(request: Request) {
  const uid = await getUidFromRequest(request)
  if (!uid) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = (await request.json().catch(() => null)) as RequestBody | null
  if (!body?.offerId || typeof body.offerId !== 'string') return badRequest('Missing offerId.')
  const { offerId } = body

  const adminDb = getAdminDb()

  const offerSnap = await adminDb.collection('offers').doc(offerId).get()
  if (!offerSnap.exists) return NextResponse.json({ error: 'Offer not found.' }, { status: 404 })
  const offer = offerSnap.data()!

  const expiryDate = offer.expiryDate instanceof Timestamp ? offer.expiryDate.toDate() : null
  const totalQuantity = typeof offer.totalQuantity === 'number' ? offer.totalQuantity : null
  const claimedCount = Number(offer.claimedCount) || 0
  if (!isOfferActive({ totalQuantity, claimedCount, expiryDate })) {
    return badRequest('This offer is no longer available.')
  }

  const voucherSnap = await adminDb.collection('vouchers').doc(`${uid}_${offerId}`).get()
  if (voucherSnap.exists) {
    return NextResponse.json({ error: "You've already claimed this offer." }, { status: 409 })
  }

  const amount = Number(offer.offerPrice) || 0
  const orderRef = adminDb.collection('orders').doc(`${uid}_${offerId}`)
  await orderRef.set({
    userId: uid,
    offerId,
    businessId: offer.businessId ?? '',
    businessName: offer.businessName ?? '',
    offerTitle: offer.title ?? '',
    amount,
    currency: 'ILS',
    status: 'pending',
    createdAt: Timestamp.now(),
    paidAt: null,
    tranzilaTxnId: null,
    voucherId: null,
  })

  return NextResponse.json({
    orderId: orderRef.id,
    amount,
    currency: 'ILS' as const,
    offerTitle: offer.title ?? '',
    businessName: offer.businessName ?? '',
  })
}

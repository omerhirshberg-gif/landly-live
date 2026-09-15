import 'server-only'
import { randomInt } from 'node:crypto'
import { FieldValue, Firestore, Timestamp } from 'firebase-admin/firestore'

// Admin-SDK counterpart of the old client-side claimOffer() in
// lib/firebase/vouchers.ts — this is the only place a voucher is ever
// created now that firestore.rules deny client writes to vouchers/offers/
// businesses. Called exclusively from the Tranzila webhook route, once
// payment for the order has been confirmed.

// 8-digit numeric code, full 0-99999999 range (100M combinations). Stored/
// displayed as a string everywhere so leading zeros survive (e.g. "00012345").
function generateRedemptionCode(): string {
  return String(randomInt(0, 100_000_000)).padStart(8, '0')
}

export class ClaimOfferError extends Error {}

export async function claimOfferForOrder(
  adminDb: Firestore,
  params: { uid: string; offerId: string; businessId: string; businessName: string; offerTitle: string }
): Promise<{ voucherId: string }> {
  const { uid, offerId, businessId, businessName, offerTitle } = params
  const voucherId = `${uid}_${offerId}`

  const offerRef = adminDb.collection('offers').doc(offerId)
  const voucherRef = adminDb.collection('vouchers').doc(voucherId)
  const businessRef = adminDb.collection('businesses').doc(businessId)

  await adminDb.runTransaction(async (tx) => {
    const [offerSnap, voucherSnap] = await Promise.all([tx.get(offerRef), tx.get(voucherRef)])

    if (!offerSnap.exists) throw new ClaimOfferError('This offer no longer exists.')
    if (voucherSnap.exists) throw new ClaimOfferError("This offer has already been claimed.")

    const offer = offerSnap.data()!
    const totalQuantity = typeof offer.totalQuantity === 'number' ? offer.totalQuantity : null
    const claimedCount = Number(offer.claimedCount) || 0
    if (totalQuantity !== null && claimedCount >= totalQuantity) {
      throw new ClaimOfferError('This offer is fully claimed.')
    }

    tx.set(voucherRef, {
      userId: uid,
      offerId,
      businessId,
      businessName,
      offerTitle,
      redemptionCode: generateRedemptionCode(),
      status: 'active',
      takenAt: Timestamp.now(),
      redeemedAt: null,
    })
    tx.update(offerRef, { claimedCount: FieldValue.increment(1) })
    tx.update(businessRef, { 'voucherStats.active': FieldValue.increment(1) })
  })

  return { voucherId }
}

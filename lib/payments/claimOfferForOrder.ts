import 'server-only'
import { randomBytes } from 'node:crypto'
import { FieldValue, Firestore, Timestamp } from 'firebase-admin/firestore'

// Admin-SDK counterpart of the old client-side claimOffer() in
// lib/firebase/vouchers.ts — this is the only place a voucher is ever
// created now that firestore.rules deny client writes to vouchers/offers/
// businesses. Called exclusively from the Tranzila webhook route, once
// payment for the order has been confirmed.

// Unambiguous alphabet (no 0/O/1/I) since this is read off a screen by hand.
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

function generateRedemptionCode(length = 8): string {
  const bytes = randomBytes(length)
  return Array.from(bytes, (b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join('')
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

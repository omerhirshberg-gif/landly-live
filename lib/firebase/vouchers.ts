import { doc, getDoc, Timestamp } from 'firebase/firestore'
import { db } from './config'

export interface VoucherDocument {
  userId: string
  offerId: string
  businessId: string // denormalized
  businessName: string // denormalized
  offerTitle: string // denormalized
  redemptionCode: string
  status: 'active' | 'redeemed'
  takenAt: Date | null
  redeemedAt: Date | null
}

// Deterministic per (user, offer) — lets hasUserClaimedOffer/getUserVoucherForOffer
// look a voucher up directly, and lets claimOfferForOrder (lib/payments) detect a
// duplicate claim without a query. Vouchers are created only server-side now (see
// app/api/payments/tranzila-webhook) — firestore.rules deny client writes outright.
function voucherRefId(uid: string, offerId: string): string {
  return `${uid}_${offerId}`
}

export async function hasUserClaimedOffer(uid: string, offerId: string): Promise<boolean> {
  const snap = await getDoc(doc(db, 'vouchers', voucherRefId(uid, offerId)))
  return snap.exists()
}

function toDoc(data: Record<string, unknown>): VoucherDocument {
  return {
    userId: (data.userId as string) ?? '',
    offerId: (data.offerId as string) ?? '',
    businessId: (data.businessId as string) ?? '',
    businessName: (data.businessName as string) ?? '',
    offerTitle: (data.offerTitle as string) ?? '',
    redemptionCode: (data.redemptionCode as string) ?? '',
    status: data.status === 'redeemed' ? 'redeemed' : 'active',
    takenAt: data.takenAt instanceof Timestamp ? data.takenAt.toDate() : null,
    redeemedAt: data.redeemedAt instanceof Timestamp ? data.redeemedAt.toDate() : null,
  }
}

export async function getUserVoucherForOffer(uid: string, offerId: string): Promise<VoucherDocument | null> {
  const snap = await getDoc(doc(db, 'vouchers', voucherRefId(uid, offerId)))
  if (!snap.exists()) return null
  return toDoc(snap.data())
}

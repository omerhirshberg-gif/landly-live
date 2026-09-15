import { collection, doc, getDoc, getDocs, query, where, Timestamp } from 'firebase/firestore'
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

// Two equality-only filters (userId, status) — Firestore covers this with its
// automatic single-field indexes, no composite index needed. Filtering by
// status here (not client-side) keeps redeemed vouchers out of callers like
// PerksTab that should only ever see active ones.
export async function getUserVouchers(
  uid: string,
  status: VoucherDocument['status']
): Promise<(VoucherDocument & { id: string })[]> {
  const snap = await getDocs(
    query(collection(db, 'vouchers'), where('userId', '==', uid), where('status', '==', status))
  )
  return snap.docs
    .map((d) => ({ id: d.id, ...toDoc(d.data()) }))
    .sort((a, b) => (b.takenAt?.getTime() ?? 0) - (a.takenAt?.getTime() ?? 0))
}

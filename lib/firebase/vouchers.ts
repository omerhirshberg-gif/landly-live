import { collection, getDocs, onSnapshot, query, where, limit, Timestamp } from 'firebase/firestore'
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

// What a voucher's QR code encodes -- shared so the web member area and the
// mobile wallet show businesses the exact same code.
export function voucherRedeemUrl(voucherId: string): string {
  return `https://golandly.com/redeem/${voucherId}`
}

// Owner-scoped queries can safely return empty results without allowing
// arbitrary missing-document reads in the security rules.
function voucherForOfferQuery(uid: string, offerId: string) {
  return query(collection(db, 'vouchers'), where('userId', '==', uid), where('offerId', '==', offerId), limit(1))
}

export async function hasUserClaimedOffer(uid: string, offerId: string): Promise<boolean> {
  return !(await getDocs(voucherForOfferQuery(uid, offerId))).empty
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
  const snap = await getDocs(voucherForOfferQuery(uid, offerId))
  return snap.empty ? null : toDoc(snap.docs[0].data())
}

// Two equality-only filters (userId, status) — Firestore covers this with its
// automatic single-field indexes, no composite index needed. Filtering by
// status here (not client-side) keeps redeemed vouchers out of callers like
// PerksTab that should only ever see active ones.
function userVouchersQuery(uid: string, status: VoucherDocument['status']) {
  return query(collection(db, 'vouchers'), where('userId', '==', uid), where('status', '==', status))
}

function toSortedVouchers(docs: { id: string; data: () => Record<string, unknown> }[]): (VoucherDocument & { id: string })[] {
  return docs
    .map((d) => ({ id: d.id, ...toDoc(d.data()) }))
    .sort((a, b) => (b.takenAt?.getTime() ?? 0) - (a.takenAt?.getTime() ?? 0))
}

export async function getUserVouchers(
  uid: string,
  status: VoucherDocument['status']
): Promise<(VoucherDocument & { id: string })[]> {
  return toSortedVouchers((await getDocs(userVouchersQuery(uid, status))).docs)
}

// Live version of getUserVouchers, for the mobile wallet: a voucher written
// by the payment webhook (from a web purchase) or flipped to redeemed by the
// business shows up without a refresh. `onError` gets permission-denied for
// an unverified/business session, same as the one-shot read would.
export function subscribeToUserVouchers(
  uid: string,
  status: VoucherDocument['status'],
  onChange: (vouchers: (VoucherDocument & { id: string })[]) => void,
  onError: (error: Error) => void
): () => void {
  return onSnapshot(userVouchersQuery(uid, status), (snap) => onChange(toSortedVouchers(snap.docs)), onError)
}

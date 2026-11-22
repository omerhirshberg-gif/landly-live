import { normalizeWebsiteUrl, parsePhones } from '@/lib/offers/contact'
import { collection, doc, getDocs, onSnapshot, query, where, limit, Timestamp } from 'firebase/firestore'
import { db } from './config'
import { parseVoucherStatus, type VoucherStatus } from '../vouchers/status'
import { recheckSessionIfDenied } from './sessionCheck'
import { normalizeRedemptionTerms } from '../payments/voucherTerms'
import { normalizeRedemptionInstructions, normalizeRedemptionMethod, type RedemptionMethod } from '../offers/redemption'
import { isOrderNumber, normalizeDisplayOrderNumber } from '../payments/orderNumber'
import { parseOfferTranslations, type OfferTranslations } from '../offers/offerText'
import { parseBusinessTranslations, type BusinessTranslations } from '../business/businessText'
import { parseIssuer, type VoucherIssuer } from '../payments/issuer'
import { parseFulfillmentType, type FulfillmentType } from '../inventory/types'
import { readPerkScope, type PerkScope } from '../offers/perkScope'
import { parseCoordinates, parsePlaceSnapshot, type Coordinates, type ParticipatingPlace, type PlaceSnapshot } from '../geo'

// refunded: cancelled through support after purchase (set by an admin, never
// by a client); it leaves the wallet like a redeemed one, but was never used.
// cancelled: cancelled because its owner's account was permanently deleted
// (lib/users/deleteUserPermanently.server.ts); never redeemable, never settled.
export type { VoucherStatus }

export interface VoucherDocument {
  userId: string
  offerId: string
  businessId: string // denormalized
  businessName: string // denormalized
  offerTitle: string // denormalized
  redemptionCode: string
  // A Raayonit voucher's own code, handed out at checkout (lib/inventory/poolAllocation.ts); null for merchant-honoured vouchers.
  externalCode?: string | null
  // 'code_only': the voucher is its code alone (Raayonit): no QR code anywhere, and the member can mark it used. Absent = QR voucher.
  redemptionKind?: 'code_only' | null
  // Who issued a pre-bought voucher, shown with its logo (lib/payments/issuer.ts), and what it is worth in agorot.
  issuer?: VoucherIssuer | null
  faceValueAgorot?: number | null
  // What the member paid, in agorot (set by the payment webhook); the paid half of "₪79 / ₪100" (lib/vouchers/voucherValue.ts).
  amountAgorot?: number | null
  // The Raayonit stock the voucher's code came from (set by the payment webhook); absent on older ones, which are the offer's default stock.
  poolId?: string | null
  // What the member saved on this purchase, in agorot (set by the payment webhook; lib/member/savings.ts); absent on older vouchers.
  savingsAgorot?: number | null
  // How much of the voucher's worth has been used, in agorot; absent (= 0) until a redeem flow records a partial use. A redeemed voucher counts as fully used (lib/vouchers/redemptionProgress.ts).
  redeemedAgorot?: number | null
  // What the QR code carries (redeemVoucherKey): 128 random bits, set by the
  // payment webhook. null for vouchers issued before it existed, until
  // scripts/backfill-redeem-tokens.mjs gives them one.
  redeemToken: string | null
  status: VoucherStatus
  takenAt: Date | null
  redeemedAt: Date | null
  // Set by the payment webhook from the order's validityDays; null only for
  // vouchers issued before validity periods existed.
  expiresAt: Date | null
  redemptionTerms: string // snapshot from the order, so later offer edits never change a bought voucher
  redemptionMethod: RedemptionMethod // snapshot like redemptionTerms; 'in_store' for vouchers issued before methods existed
  redemptionInstructions: string // snapshot like redemptionTerms; '' = the method's default steps
  // Its order's sequential number ("#1001"); null for vouchers issued before numbering existed.
  orderNumber: number | null
  displayOrderNumber: string | null
  // The offer's translated text as it was at purchase (lib/offers/offerText.ts); null for older ones.
  translations?: OfferTranslations | null
  // The business's name in other languages and its address, as they were at purchase; null for older ones.
  businessTranslations?: BusinessTranslations | null
  businessAddress?: PlaceSnapshot | null
  businessGeo?: Coordinates | null
  // A Raayonit voucher has no business: its brand and, for a multi-chain one, the chains and shared guide as at purchase.
  perkScope?: PerkScope
  isNationwide?: boolean // as at purchase; absent on vouchers from before the flag, which read as false
  fulfillmentType?: FulfillmentType
  brandName?: string
  participatingChains?: string[]
  participatingPlaces?: ParticipatingPlace[] // the branches picked from Google Places, as at purchase
  chainsCount?: number
  universalRedemptionGuide?: { he: string; en: string } | null
  websiteUrl?: string // the business's website as at purchase (Raayonit)
  contactPhone?: string // and its phone, for a single-location business
}

export { redeemVoucherKey, voucherRedeemUrl } from '../offers/redeemLink'

const REDEEM_TOKEN_PATTERN = /^[0-9a-f]{32}$/

// Owner-scoped queries can safely return empty results without allowing
// arbitrary missing-document reads in the security rules.
function voucherForOfferQuery(uid: string, offerId: string) {
  return query(collection(db, 'vouchers'), where('userId', '==', uid), where('offerId', '==', offerId), limit(1))
}

export async function hasUserClaimedOffer(uid: string, offerId: string): Promise<boolean> {
  return !(await getDocs(voucherForOfferQuery(uid, offerId))).empty
}

/**
 * The stocks (pool ids) the member already holds a voucher for on this offer, for the denomination picker. A voucher without a
 * pool predates variants and counts for `defaultPoolId`. `any` is whether they hold a voucher at all.
 */
export async function getClaimedPoolIds(uid: string, offerId: string, defaultPoolId: string | null): Promise<{ any: boolean; pools: string[] }> {
  const snap = await getDocs(query(collection(db, 'vouchers'), where('userId', '==', uid), where('offerId', '==', offerId), limit(10)))
  const pools = snap.docs.map((d) => (typeof d.data().poolId === 'string' && d.data().poolId ? (d.data().poolId as string) : defaultPoolId)).filter((p): p is string => !!p)
  return { any: !snap.empty, pools: [...new Set(pools)] }
}

function toDoc(data: Record<string, unknown>): VoucherDocument {
  return {
    userId: (data.userId as string) ?? '',
    offerId: (data.offerId as string) ?? '',
    businessId: (data.businessId as string) ?? '',
    businessName: (data.businessName as string) ?? '',
    offerTitle: (data.offerTitle as string) ?? '',
    redemptionCode: (data.redemptionCode as string) ?? '',
    externalCode: typeof data.externalCode === 'string' && data.externalCode ? data.externalCode : null,
    redemptionKind: data.redemptionKind === 'code_only' ? 'code_only' : null,
    issuer: parseIssuer(data.issuer),
    amountAgorot: typeof data.amountAgorot === 'number' && Number.isFinite(data.amountAgorot) && data.amountAgorot > 0 ? data.amountAgorot : null,
    faceValueAgorot: typeof data.faceValueAgorot === 'number' && Number.isInteger(data.faceValueAgorot) && data.faceValueAgorot > 0 ? data.faceValueAgorot : null,
    poolId: typeof data.poolId === 'string' && data.poolId ? data.poolId : null,
    redeemedAgorot: typeof data.redeemedAgorot === 'number' && Number.isFinite(data.redeemedAgorot) && data.redeemedAgorot >= 0 ? data.redeemedAgorot : null,
    savingsAgorot: typeof data.savingsAgorot === 'number' && Number.isFinite(data.savingsAgorot) && data.savingsAgorot >= 0 ? data.savingsAgorot : null,
    redeemToken: typeof data.redeemToken === 'string' && REDEEM_TOKEN_PATTERN.test(data.redeemToken) ? data.redeemToken : null,
    status: parseVoucherStatus(data.status),
    takenAt: data.takenAt instanceof Timestamp ? data.takenAt.toDate() : null,
    redeemedAt: data.redeemedAt instanceof Timestamp ? data.redeemedAt.toDate() : null,
    expiresAt: data.expiresAt instanceof Timestamp ? data.expiresAt.toDate() : null,
    redemptionTerms: normalizeRedemptionTerms(data.redemptionTerms),
    redemptionMethod: normalizeRedemptionMethod(data.redemptionMethod),
    redemptionInstructions: normalizeRedemptionInstructions(data.redemptionInstructions),
    orderNumber: isOrderNumber(data.orderNumber) ? data.orderNumber : null,
    displayOrderNumber: normalizeDisplayOrderNumber(data.displayOrderNumber),
    translations: parseOfferTranslations(data.translations),
    businessTranslations: parseBusinessTranslations(data.businessTranslations),
    businessAddress: parsePlaceSnapshot(data.businessAddress),
    businessGeo: parseCoordinates(data.businessGeo),
    fulfillmentType: parseFulfillmentType(data.fulfillmentType),
    ...(normalizeWebsiteUrl(data.websiteUrl) ? { websiteUrl: normalizeWebsiteUrl(data.websiteUrl) } : {}),
    ...(parsePhones(data.contactPhone).length > 0 ? { contactPhone: String(data.contactPhone).trim() } : {}),
    ...readPerkScope(data),
  }
}

export async function getUserVoucherForOffer(uid: string, offerId: string): Promise<VoucherDocument | null> {
  const snap = await getDocs(voucherForOfferQuery(uid, offerId))
  return snap.empty ? null : toDoc(snap.docs[0].data())
}

// One voucher by id, live: the checkout success page shows the pass the
// webhook issued for its order (voucher id = order id). A missing or foreign
// voucher is permission-denied by the rules, which reads as null here.
export function subscribeToVoucher(voucherId: string, onChange: (voucher: (VoucherDocument & { id: string }) | null) => void): () => void {
  return onSnapshot(
    doc(db, 'vouchers', voucherId),
    (snap) => onChange(snap.exists() ? { id: snap.id, ...toDoc(snap.data()) } : null),
    (error) => {
      recheckSessionIfDenied(error)
      onChange(null)
    }
  )
}

// Two equality-only filters (userId, status) — Firestore covers this with its
// automatic single-field indexes, no composite index needed. Filtering by
// status here (not client-side) keeps redeemed vouchers out of callers like
// PerksTab that should only ever see active ones.
// Capped: nobody holds anywhere near this many, but a runaway account can't make
// every snapshot unbounded.
export const MEMBER_VOUCHERS_LIMIT = 300

function userVouchersQuery(uid: string, status: VoucherDocument['status']) {
  return query(collection(db, 'vouchers'), where('userId', '==', uid), where('status', '==', status), limit(MEMBER_VOUCHERS_LIMIT))
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
// an unverified/business session, same as the one-shot read would, and for
// one revoked on another device (which recheckSessionIfDenied then signs out).
export function subscribeToUserVouchers(
  uid: string,
  status: VoucherDocument['status'],
  onChange: (vouchers: (VoucherDocument & { id: string })[]) => void,
  onError: (error: Error) => void
): () => void {
  return onSnapshot(userVouchersQuery(uid, status), (snap) => onChange(toSortedVouchers(snap.docs)), (error) => {
    recheckSessionIfDenied(error)
    onError(error)
  })
}

import { collection, doc, getDoc, getDocs, query, Timestamp, where } from 'firebase/firestore'
import { db } from './config'
import { compareFeatured, discountPercent, offerMatchesSearch } from '../perks/perksFilter'
import { normalizeRedemptionTerms, normalizeValidityDays } from '../payments/voucherTerms'
import { normalizeImageUrl } from '../offers/imageUrl'
import { normalizeRedemptionInstructions, normalizeRedemptionMethod, type RedemptionMethod } from '../offers/redemption'

export interface OfferDocument {
  id: string
  businessId: string
  businessName: string // denormalized
  location: string // denormalized from businesses/{businessId}.location
  imageUrl: string // externally-hosted image link, admin-pasted; empty = no image
  title: string
  description: string
  originalPrice: number
  offerPrice: number
  category: string
  createdAt: Date | null // server-set at creation, immutable; null only for offers that predate this field
  isBestseller: boolean // manual admin toggle
  expiryDate: Date | null
  totalQuantity: number | null // null = unlimited claims
  claimedCount: number
  validityDays: number // how long a voucher bought now stays valid; DEFAULT_VOUCHER_VALIDITY_DAYS when unset
  redemptionTerms: string // the merchant's conditions for using the voucher; '' = none stated
  redemptionMethod: RedemptionMethod // in store, online or by phone; 'in_store' for offers from before methods existed
  redemptionInstructions: string // the merchant's own steps, one per line; '' = the method's default steps
}

function toDoc(id: string, data: Record<string, unknown>): OfferDocument {
  return {
    id,
    businessId: (data.businessId as string) ?? '',
    businessName: (data.businessName as string) ?? '',
    location: (data.location as string) ?? '',
    // Normalized on read too, so links saved before the admin routes did it still render.
    imageUrl: normalizeImageUrl(typeof data.imageUrl === 'string' ? data.imageUrl : ''),
    title: (data.title as string) ?? '',
    description: (data.description as string) ?? '',
    originalPrice: Number(data.originalPrice) || 0,
    offerPrice: Number(data.offerPrice) || 0,
    category: (data.category as string) ?? '',
    createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate() : null,
    isBestseller: !!data.isBestseller,
    expiryDate: data.expiryDate instanceof Timestamp ? data.expiryDate.toDate() : null,
    totalQuantity: typeof data.totalQuantity === 'number' ? data.totalQuantity : null,
    claimedCount: Number(data.claimedCount) || 0,
    validityDays: normalizeValidityDays(data.validityDays),
    redemptionTerms: normalizeRedemptionTerms(data.redemptionTerms),
    redemptionMethod: normalizeRedemptionMethod(data.redemptionMethod),
    redemptionInstructions: normalizeRedemptionInstructions(data.redemptionInstructions),
  }
}

function isNotExpired(offer: OfferDocument, now: number): boolean {
  return !offer.expiryDate || offer.expiryDate.getTime() >= now
}

// Still claimable: unlimited, or not every voucher claimed yet. The Perks
// rails show only these (sold-out offers stay reachable from search and links).
export function isOfferAvailable(offer: Pick<OfferDocument, 'totalQuantity' | 'claimedCount'>): boolean {
  return offer.totalQuantity === null || offer.claimedCount < offer.totalQuantity
}

const NEW_OFFER_WINDOW_MS = 14 * 24 * 60 * 60 * 1000

// Computed on read, not stored — "new" is a rolling 14-day window off createdAt.
export function isOfferNew(createdAt: Date | null): boolean {
  return !!createdAt && Date.now() - createdAt.getTime() < NEW_OFFER_WINDOW_MS
}

// The ordering and matching rules live in lib/perks/perksFilter.ts (pure,
// shared with the Perks filter engine); these keep their original names.
export function getOfferDiscountPercent(originalPrice: number, offerPrice: number): number {
  return discountPercent(originalPrice, offerPrice)
}

// Bestsellers first, then newest: the order the member home screens (web
// LoggedInHome, Expo Home and Perks tabs) show offers in.
export function sortFeaturedOffers(offers: OfferDocument[]): OfferDocument[] {
  return [...offers].sort(compareFeatured)
}

// Title, merchant or stored category name; the Perks engine also matches the
// translated category label (offerMatchesSearch with a translator).
export function offerMatchesQuery(offer: OfferDocument, normalizedQuery: string): boolean {
  return offerMatchesSearch(offer, normalizedQuery)
}

// Offers are admin-managed only (created manually, same as businesses/{uid})
// — no writer here, just the readers the customer-facing pages need.
export async function getOffer(offerId: string): Promise<OfferDocument | null> {
  const snap = await getDoc(doc(db, 'offers', offerId))
  if (!snap.exists()) return null
  return toDoc(snap.id, snap.data())
}

// For a caller-supplied list of ids (e.g. a wishlist) — an id whose offer was
// deleted since just comes back missing rather than throwing, so callers can
// render "skip it" behavior for free.
export async function getOffersByIds(ids: string[]): Promise<OfferDocument[]> {
  const offers = await Promise.all(ids.map((id) => getOffer(id)))
  return offers.filter((offer): offer is OfferDocument => offer !== null)
}

export async function getOffersByCategory(category: string): Promise<OfferDocument[]> {
  const snap = await getDocs(query(collection(db, 'offers'), where('category', '==', category)))
  const now = Date.now()
  return snap.docs.map((d) => toDoc(d.id, d.data())).filter((offer) => isNotExpired(offer, now))
}

// Single unfiltered fetch for pages that need offers across every category
// (e.g. the /categories overview) — cheaper than one query per category.
export async function getAllOffers(): Promise<OfferDocument[]> {
  const snap = await getDocs(collection(db, 'offers'))
  const now = Date.now()
  return snap.docs.map((d) => toDoc(d.id, d.data())).filter((offer) => isNotExpired(offer, now))
}

export async function getBestsellerOffers(): Promise<OfferDocument[]> {
  const snap = await getDocs(query(collection(db, 'offers'), where('isBestseller', '==', true)))
  const now = Date.now()
  return snap.docs.map((d) => toDoc(d.id, d.data())).filter((offer) => isNotExpired(offer, now))
}

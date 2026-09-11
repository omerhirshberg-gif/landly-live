import { collection, doc, getDoc, getDocs, query, Timestamp, where } from 'firebase/firestore'
import { db } from './config'

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
}

function toDoc(id: string, data: Record<string, unknown>): OfferDocument {
  return {
    id,
    businessId: (data.businessId as string) ?? '',
    businessName: (data.businessName as string) ?? '',
    location: (data.location as string) ?? '',
    imageUrl: (data.imageUrl as string) ?? '',
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
  }
}

function isNotExpired(offer: OfferDocument, now: number): boolean {
  return !offer.expiryDate || offer.expiryDate.getTime() >= now
}

const NEW_OFFER_WINDOW_MS = 14 * 24 * 60 * 60 * 1000

// Computed on read, not stored — "new" is a rolling 14-day window off createdAt.
export function isOfferNew(createdAt: Date | null): boolean {
  return !!createdAt && Date.now() - createdAt.getTime() < NEW_OFFER_WINDOW_MS
}

// No manual percentage field anywhere — always derived from the two prices.
export function getOfferDiscountPercent(originalPrice: number, offerPrice: number): number {
  if (originalPrice <= 0) return 0
  return Math.round((1 - offerPrice / originalPrice) * 100)
}

// Shared by /categories (search across all offers) and /categories/[category]
// (search within one category's already-fetched list) so matching stays in sync.
export function offerMatchesQuery(offer: OfferDocument, normalizedQuery: string): boolean {
  return (
    offer.title.toLowerCase().includes(normalizedQuery) ||
    offer.businessName.toLowerCase().includes(normalizedQuery) ||
    offer.category.toLowerCase().includes(normalizedQuery)
  )
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

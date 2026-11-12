import { collection, doc, documentId, getDoc, getDocs, limit, query, where } from 'firebase/firestore'
import { db } from './config'
import { compareFeatured, discountPercent, offerMatchesSearch } from '../perks/perksFilter'
import { toOfferDocument, type OfferDocument } from '../offers/offerDocument'
import { fetchOffersFromApi } from '../offers/offersApi'

export type { OfferDocument } from '../offers/offerDocument'

// Offers are read in one shot and filtered on the device, so the read is
// capped: hundreds of live offers is the design size (see /api/public/offers).
export const OFFERS_READ_LIMIT = 500
// Firestore's `in` takes at most 30 values.
const IN_CHUNK = 30

const toDoc = toOfferDocument

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
// render "skip it" behavior for free. Read in chunks of 30 with one `in` query
// each (not one read per id); the result keeps the order of `ids`.
export async function getOffersByIds(ids: string[]): Promise<OfferDocument[]> {
  const unique = [...new Set(ids)]
  const found = new Map<string, OfferDocument>()
  for (let i = 0; i < unique.length; i += IN_CHUNK) {
    const snap = await getDocs(query(collection(db, 'offers'), where(documentId(), 'in', unique.slice(i, i + IN_CHUNK))))
    for (const d of snap.docs) found.set(d.id, toDoc(d.id, d.data()))
  }
  return ids.flatMap((id) => {
    const offer = found.get(id)
    return offer ? [offer] : []
  })
}

// One shared, short-lived copy of the live offers: Home, Perks, categories and
// the landing all read the same list, so within the TTL they cost one fetch
// between them, and concurrent callers share one in-flight request.
export const OFFERS_CACHE_TTL_MS = 60_000
let offersCache: { at: number; promise: Promise<OfferDocument[]> } | null = null

async function loadOffers(): Promise<OfferDocument[]> {
  try {
    return await fetchOffersFromApi()
  } catch {
    // The CDN route is an optimization: if it is down or unreachable, read Firestore directly.
    const snap = await getDocs(query(collection(db, 'offers'), limit(OFFERS_READ_LIMIT)))
    return snap.docs.map((d) => toDoc(d.id, d.data()))
  }
}

/** Drops the shared copy, e.g. after the member signs out or on a pull-to-refresh. */
export function clearOffersCache() {
  offersCache = null
}

// The live offers (not expired). `force` skips the shared copy (pull-to-refresh).
export async function getAllOffers({ force = false }: { force?: boolean } = {}): Promise<OfferDocument[]> {
  const now = Date.now()
  if (force || !offersCache || now - offersCache.at > OFFERS_CACHE_TTL_MS) {
    const promise = loadOffers()
    const entry = { at: now, promise }
    offersCache = entry
    // A failed load is never kept, so the next caller retries instead of replaying the error.
    promise.catch(() => {
      if (offersCache === entry) offersCache = null
    })
  }
  const offers = await offersCache!.promise
  const current = Date.now()
  return offers.filter((offer) => isNotExpired(offer, current))
}

export async function getOffersByCategory(category: string): Promise<OfferDocument[]> {
  return (await getAllOffers()).filter((offer) => offer.category === category)
}

export async function getBestsellerOffers(): Promise<OfferDocument[]> {
  return (await getAllOffers()).filter((offer) => offer.isBestseller)
}

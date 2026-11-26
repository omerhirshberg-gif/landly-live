import { db } from './config'
import { compareFeatured, discountPercent, offerMatchesSearch } from '../perks/perksFilter'
import type { OfferDocument } from '../offers/offerDocument'
import { fetchOffersFromApi } from '../offers/offersApi'
import { browserOffersStorage, createOffersStore, OFFERS_FRESH_MS, offersStorageKey } from '../offers/offersStore'

export type { OfferDocument } from '../offers/offerDocument'


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
  // From the public list, which holds only offers that are on sale right now (published, unexpired, in stock, business active).
  return (await getAllOffers()).find((offer) => offer.id === offerId) ?? null
}

// For a caller-supplied list of ids (e.g. a wishlist) — an id whose offer was
// deleted since just comes back missing rather than throwing, so callers can
// render "skip it" behavior for free. Read from the shared list (no Firestore
// read per id); the result keeps the order of `ids`.
export async function getOffersByIds(ids: string[]): Promise<OfferDocument[]> {
  // A saved offer that is no longer on sale (expired, sold out, suspended, deleted) is skipped, like a deleted one.
  const live = new Map((await getAllOffers()).map((offer) => [offer.id, offer]))
  const found = live
  return ids.flatMap((id) => {
    const offer = found.get(id)
    return offer ? [offer] : []
  })
}

// One shared copy of the live offers (lib/offers/offersStore.ts): Home, Perks,
// categories, the wishlist and the landing all read the same list, so they
// cost one fetch between them and concurrent callers share one request. A held
// copy is returned at once and refreshed quietly once it is a minute old; the
// last good list is saved on the device, scoped to this Firebase project.
export const OFFERS_CACHE_TTL_MS = OFFERS_FRESH_MS

async function loadOffers(): Promise<OfferDocument[]> {
  // The cached API is the only path: `offers` is not readable from the client SDK (firestore.rules), so a failure
  // throws and the store keeps serving its last good copy.
  return await fetchOffersFromApi()
}

function projectId(): string | null {
  try {
    return (db as { app?: { options?: { projectId?: string } } }).app?.options?.projectId ?? null
  } catch {
    return null
  }
}

const storageKey = projectId()
export const offersStore = createOffersStore({
  load: loadOffers,
  storageKey: storageKey ? offersStorageKey(storageKey) : null,
  // The website saves in localStorage; the app swaps in AsyncStorage at startup (landly-mobile/src/app/_layout.tsx).
  storage: browserOffersStorage(),
})

/** Drops the shared copy, e.g. after the member signs out. */
export function clearOffersCache() {
  offersStore.clear()
}

// The live offers (not expired). `force` waits for a new load (pull-to-refresh).
export function getAllOffers({ force = false }: { force?: boolean } = {}): Promise<OfferDocument[]> {
  return offersStore.get({ force })
}

export async function getOffersByCategory(category: string): Promise<OfferDocument[]> {
  return (await getAllOffers()).filter((offer) => offer.category === category)
}

export async function getBestsellerOffers(): Promise<OfferDocument[]> {
  return (await getAllOffers()).filter((offer) => offer.isBestseller)
}

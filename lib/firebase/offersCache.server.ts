import 'server-only'
import { revalidateTag, unstable_cache } from 'next/cache'
import { getAdminDb } from './admin'
import { offerToWire, toOfferDocument, type OfferWire } from '@/lib/offers/offerDocument'

// The live offers for GET /api/public/offers: read once with the Admin SDK
// (getAdminDb(), so DEV and PROD each read their own project), kept in the
// Next data cache for a minute, and dropped at once when an admin changes an
// offer (revalidatePublicOffers). Checkout never reads this: initiateOrder and
// claimOfferForOrder re-read the offer inside their transactions.
export const PUBLIC_OFFERS_TAG = 'public-offers'
export const PUBLIC_OFFERS_LIMIT = 500
export const PUBLIC_OFFERS_REVALIDATE_SECONDS = 60

async function readLiveOffers(): Promise<OfferWire[]> {
  const snap = await getAdminDb().collection('offers').limit(PUBLIC_OFFERS_LIMIT).get()
  const now = Date.now()
  return snap.docs
    .map((d) => toOfferDocument(d.id, d.data()))
    .filter((offer) => !offer.expiryDate || offer.expiryDate.getTime() >= now)
    .map(offerToWire)
}

export const getCachedPublicOffers = unstable_cache(readLiveOffers, ['public-offers-v1'], {
  revalidate: PUBLIC_OFFERS_REVALIDATE_SECONDS,
  tags: [PUBLIC_OFFERS_TAG],
})

/** Call after any admin write that changes what an offer shows. Never throws: a write has already succeeded. */
export function revalidatePublicOffers() {
  try {
    revalidateTag(PUBLIC_OFFERS_TAG, { expire: 0 })
  } catch {
    // Outside a Next request (scripts, tests) there is no cache to drop.
  }
}

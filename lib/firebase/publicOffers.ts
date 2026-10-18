import 'server-only'
import { cache } from 'react'
import { getAdminDb } from './admin'
import { isOfferLive, toPublicOffer, type PublicOffer } from '@/lib/offers/publicOffer'

// Server reads of offers for search engines (sitemap, JSON-LD, the perk
// page's metadata). Offers are public (firestore.rules), so this reveals
// nothing the site doesn't. Every failure -- no Admin credentials in a local
// build, Firestore unreachable -- comes back empty, so a page or the sitemap
// falls back instead of failing.

/** One offer; cached per request, so a page's metadata and its layout share the read. */
export const getPublicOffer = cache(async (offerId: string): Promise<PublicOffer | null> => {
  try {
    return toPublicOffer(offerId, (await getAdminDb().collection('offers').doc(offerId).get()).data())
  } catch {
    return null
  }
})

/** Every live offer (not expired), newest first. */
export async function getLivePublicOffers(): Promise<PublicOffer[]> {
  try {
    const snap = await getAdminDb().collection('offers').get()
    return snap.docs
      .map((d) => toPublicOffer(d.id, d.data()))
      .filter((offer): offer is PublicOffer => !!offer && isOfferLive(offer))
      .sort((a, b) => (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0))
  } catch {
    return []
  }
}

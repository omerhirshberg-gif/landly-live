import { router } from 'expo-router'
import type { OfferDocument } from '@shared/firebase/offers'

// Offers already on screen, by id, so the pushed offer screen draws the tapped
// card's data at once and only refreshes it from Firestore behind the scenes.
const seen = new Map<string, OfferDocument>()

export function cachedOffer(offerId: string): OfferDocument | undefined {
  return seen.get(offerId)
}

// A perk card opens its offer on a native screen (app/offer/[offerId].tsx)
// pushed over the current one, never the system browser. Only checkout runs
// on the website, in an in-app browser sheet opened from that screen.
export function openOffer(offer: OfferDocument) {
  seen.set(offer.id, offer)
  router.push({ pathname: '/offer/[offerId]', params: { offerId: offer.id } })
}

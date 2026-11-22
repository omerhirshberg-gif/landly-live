import { router } from 'expo-router'
import type { OfferDocument } from '@shared/firebase/offers'
import { isFlagship } from '@shared/offers/discoverTab'
import { variantForDenomination } from '@shared/home/superShowcase'
import { RAAYONIT_HUB } from '@shared/offers/offerRoutes'

// Offers already on screen, by id, so the pushed offer screen draws the tapped
// card's data at once and only refreshes it from Firestore behind the scenes.
const seen = new Map<string, OfferDocument>()

/** Remembers an offer for the screen about to open (the checkout draws it at once). */
export function rememberOffer(offer: OfferDocument) {
  seen.set(offer.id, offer)
}

export function cachedOffer(offerId: string): OfferDocument | undefined {
  return seen.get(offerId)
}

// A perk card opens its offer on a native screen (app/offer/[offerId].tsx)
// pushed over the current one, never the system browser -- and so is its
// checkout (app/checkout/[offerId].tsx).
// The Raayonit Card itself opens the hub (/raayonit: its 100 / 150 selector and every domain), unless a value was picked or the
// caller is already on the hub (`direct`). A chain and a direct perk always open the offer screen (lib/offers/offerRoutes.ts).
export function openOffer(offer: OfferDocument, denomination?: number, direct = false) {
  seen.set(offer.id, offer)
  // The flagship never has an offer screen of its own: the hub (or the 1-click checkout from it) is where it is bought.
  if (isFlagship(offer)) {
    if (direct && denomination) {
      const variant = variantForDenomination(offer.variants ?? [], denomination)
      router.push({ pathname: '/checkout/[offerId]', params: { offerId: offer.id, ...(variant ? { variant: variant.poolId } : {}) } })
    } else router.push(RAAYONIT_HUB)
    return
  }
  // A showcase card passes its value so the offer screen opens with it picked.
  router.push({ pathname: '/offer/[offerId]', params: denomination ? { offerId: offer.id, denomination: String(denomination) } : { offerId: offer.id } })
}

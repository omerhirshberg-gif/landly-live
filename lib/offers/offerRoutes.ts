// The one place that says where a tap goes. Shared by the website and the Expo app (`@shared/offers/offerRoutes`), so a Raayonit
// voucher, a Raayonit chain and a direct GoLandly perk can never land on each other's screen.
//
//   flagship (the Raayonit Card)       -> the hub: /raayonit, with the 100 / 150 purchase selector and all 18 domains
//   chain (a business that honours it) -> the offer screen, chain layout    (web /offers/[id], native /offer/[offerId])
//   direct (a GoLandly merchant perk)  -> the offer screen, merchant layout (same paths; the screen switches on the offer)
import type { OfferDocument } from '../firebase/offers'
import { isChain, isFlagship } from './discoverTab'

export type OfferRouteKind = 'flagship' | 'chain' | 'direct'
type Kind = Pick<OfferDocument, 'fulfillmentType' | 'perkScope'>

export const offerRouteKind = (offer: Kind): OfferRouteKind => (isFlagship(offer) ? 'flagship' : isChain(offer) ? 'chain' : 'direct')

/** The Raayonit hub, web path and native route name alike. */
export const RAAYONIT_HUB = '/raayonit'
/** The Raayonit Card's details page: the step between the hub's "Order voucher" and checkout (what it is, how to redeem, who accepts it, the value choice). */
export const RAAYONIT_CARD_PAGE = '/raayonit/card'
export const raayonitHubPath = (category?: string): string => (category && category !== 'all' ? `${RAAYONIT_HUB}?category=${encodeURIComponent(category)}` : RAAYONIT_HUB)

/** Web: the offer page. */
export const webOfferPath = (offerId: string, denomination?: number): string =>
  `/offers/${encodeURIComponent(offerId)}${denomination ? `?denomination=${denomination}` : ''}`

/** Web: where a card goes. The flagship card opens the hub; every other offer opens its own page. */
export const webOfferHref = (offer: Kind & { id: string }): string => (isFlagship(offer) ? RAAYONIT_HUB : webOfferPath(offer.id))

/** Web: the checkout for an offer, with the picked voucher value (a pool id) when it has several. */
export const checkoutPath = (offerId: string, variantPoolId?: string | null): string =>
  `/checkout?offerId=${encodeURIComponent(offerId)}${variantPoolId ? `&variant=${encodeURIComponent(variantPoolId)}` : ''}`

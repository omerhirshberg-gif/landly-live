import { showcaseCards } from '../home/superShowcase'
import type { OfferDocument } from '../firebase/offers'

/** What the Raayonit Card costs when the flagship offer is not at hand (or has no variants yet). */
export const RAAYONIT_FALLBACK_PRICE = 89

/** The cheapest denomination of the flagship Raayonit Card, in shekels; 89 until the live offer is read. */
export function raayonitStartPrice(flagship: OfferDocument | null | undefined): number {
  const prices = flagship ? showcaseCards(flagship).map((c) => c.price).filter((p) => p > 0) : []
  return prices.length > 0 ? Math.min(...prices) : RAAYONIT_FALLBACK_PRICE
}

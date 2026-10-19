import { CATEGORY_TILES, type CategoryTile } from '@/lib/categories'
import { priceDifference } from '@/lib/format'
import type { PublicOffer } from '@/lib/offers/publicOffer'
import { categoryHref, discountPercent } from '@/lib/perks/perksFilter'
import type { TranslationKey } from '@/lib/i18n/translations'

// The guest home's live showcase (partner ticker, top savings), picked from
// the offers app/page.tsx already reads on the server. Only real offers and real prices: no placeholder merchants
// or invented savings. Pure, so it's tested without Firestore.

/** The few fields the home sections show, small enough to send to the client page. */
export interface ShowcaseOffer {
  id: string
  businessName: string
  title: string
  category: string
  originalPrice: number
  offerPrice: number
}

export interface Showcase {
  offers: ShowcaseOffer[]
}

export const EMPTY_SHOWCASE: Showcase = { offers: [] }

// Enough for a ticker of distinct businesses and the top savings.
const SHOWCASE_MAX = 48

/** The live offers (newest first) as the client page's showcase. */
export function toShowcase(offers: readonly PublicOffer[]): Showcase {
  return {
    offers: offers.slice(0, SHOWCASE_MAX).map(({ id, businessName, title, category, originalPrice, offerPrice }) => ({
      id, businessName, title, category, originalPrice, offerPrice,
    })),
  }
}

const tileFor = (category: string): CategoryTile | undefined => CATEGORY_TILES.find((c) => c.category === category)

/** What a member saves on the offer, in shekels: 0 when there's no discount. */
export function offerSavings(offer: Pick<ShowcaseOffer, 'originalPrice' | 'offerPrice'>): number {
  return Math.max(0, priceDifference(offer.originalPrice, offer.offerPrice))
}

// The savings grid shows three to six cards; fewer and it steps aside.
export const SAVINGS_MIN = 3
export const SAVINGS_MAX = 6

/** The biggest real savings, one per business (so one merchant can't fill the grid); [] when fewer than SAVINGS_MIN. */
export function pickTopSavings(offers: readonly ShowcaseOffer[], max = SAVINGS_MAX): ShowcaseOffer[] {
  const seen = new Set<string>()
  const top = [...offers]
    .filter((o) => offerSavings(o) > 0)
    .sort((a, b) => offerSavings(b) - offerSavings(a))
    .filter((o) => {
      const key = o.businessName.trim().toLowerCase() || o.id
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
    .slice(0, max)
  return top.length >= SAVINGS_MIN ? top : []
}

export type MarqueeItem =
  | { kind: 'offer'; key: string; label: string; icon: string; percent: number; href: string }
  | { kind: 'category'; key: string; labelKey: TranslationKey; icon: string; href: string }

// Below this many distinct businesses the ticker would repeat one name every
// few items, so it shows the real categories instead.
export const MARQUEE_MIN_BUSINESSES = 6
const MARQUEE_MAX_BUSINESSES = 24

/** The ticker's one stream: distinct businesses (each with its best discount), or the categories when there are too few. */
export function pickMarqueeItems(offers: readonly ShowcaseOffer[]): MarqueeItem[] {
  const byBusiness = new Map<string, MarqueeItem & { kind: 'offer' }>()
  for (const offer of offers) {
    const label = offer.businessName.trim()
    const tile = tileFor(offer.category)
    if (!label || !tile) continue
    const key = label.toLowerCase()
    const percent = Math.max(0, discountPercent(offer.originalPrice, offer.offerPrice))
    const current = byBusiness.get(key)
    if (current && current.percent >= percent) continue
    byBusiness.set(key, { kind: 'offer', key: `o-${offer.id}`, label, icon: tile.icon, percent, href: `/offers/${encodeURIComponent(offer.id)}` })
  }

  return byBusiness.size >= MARQUEE_MIN_BUSINESSES
      ? [...byBusiness.values()].slice(0, MARQUEE_MAX_BUSINESSES)
    : CATEGORY_TILES.map((tile) => ({ kind: 'category', key: `c-${tile.category}`, labelKey: tile.labelKey, icon: tile.icon, href: categoryHref(tile.category) }))
}

/** How many times a row's items are laid down per half of the loop, so one half is always wider than the screen. */
export function marqueeRepeats(rowLength: number, minPerHalf = 16): number {
  return rowLength > 0 ? Math.ceil(minPerHalf / rowLength) : 0
}

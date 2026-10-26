import { CATEGORY_TILES, type CategoryTile } from '@/lib/categories'
import type { OfferTranslations } from '@/lib/offers/offerText'
import type { BusinessTranslations } from '@/lib/business/businessText'
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
  /** For the title in the reader's language (lib/i18n/contentTranslation.ts). */
  translations?: OfferTranslations | null
  /** For the business name in the reader's language (lib/business/businessText.ts). */
  businessTranslations?: BusinessTranslations | null
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
    offers: offers.slice(0, SHOWCASE_MAX).map(({ id, businessName, businessTranslations, title, category, originalPrice, offerPrice, translations }) => ({
      id, businessName, businessTranslations: businessTranslations ?? null, title, category, originalPrice, offerPrice, translations: translations ?? null,
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
  | { kind: 'offer'; key: string; label: string; businessTranslations?: BusinessTranslations | null; percent: number; href: string }
  | { kind: 'category'; key: string; labelKey: TranslationKey; href: string }

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
    byBusiness.set(key, { kind: 'offer', key: `o-${offer.id}`, label, businessTranslations: offer.businessTranslations ?? null, percent, href: `/offers/${encodeURIComponent(offer.id)}` })
  }

  return byBusiness.size >= MARQUEE_MIN_BUSINESSES
      ? [...byBusiness.values()].slice(0, MARQUEE_MAX_BUSINESSES)
    : CATEGORY_TILES.map((tile) => ({ kind: 'category', key: `c-${tile.category}`, labelKey: tile.labelKey, href: categoryHref(tile.category) }))
}

/** How many times a row's items are laid down per half of the loop, so one half is always wider than the screen. */
export function marqueeRepeats(rowLength: number, minPerHalf = 16): number {
  return rowLength > 0 ? Math.ceil(minPerHalf / rowLength) : 0
}

export type HeroFeature =
  | { kind: 'offer'; key: string; offer: ShowcaseOffer; savings: number; percent: number; href: string }
  | { kind: 'category'; key: string; category: CategoryTile['category']; labelKey: TranslationKey; href: string }

export const HERO_FEATURE_COUNT = 3

// Three everyday categories for the hero when there aren't three real savings
// to show: links into the catalogue, with no figures of their own.
const HERO_FALLBACK_CATEGORIES = ['Sport and Fitness', 'Restaurants and Cafes', 'Cars and Transport'] as const

/**
 * The hero's three feature cards: the biggest real savings, one per business
 * and a different category each where the catalogue allows, with the deepest
 * discount among them moved to the third card (the one with the sticker).
 * Fewer than three savings and all three cards are categories instead, so the
 * grid never mixes a figure with a blank.
 */
export function pickHeroFeatures(offers: readonly ShowcaseOffer[]): HeroFeature[] {
  const ranked = pickTopSavings(offers, offers.length)
  const picks: ShowcaseOffer[] = []
  const categories = new Set<string>()
  for (const offer of ranked) {
    if (picks.length === HERO_FEATURE_COUNT) break
    if (categories.has(offer.category)) continue
    categories.add(offer.category)
    picks.push(offer)
  }
  for (const offer of ranked) {
    if (picks.length === HERO_FEATURE_COUNT) break
    if (!picks.includes(offer)) picks.push(offer)
  }

  if (picks.length < HERO_FEATURE_COUNT) {
    return HERO_FALLBACK_CATEGORIES.map((category) => ({
      kind: 'category', key: `c-${category}`, category, labelKey: tileFor(category)!.labelKey, href: categoryHref(category),
    }))
  }

  const features = picks.map((offer): HeroFeature & { kind: 'offer' } => ({
    kind: 'offer',
    key: `o-${offer.id}`,
    offer,
    savings: offerSavings(offer),
    percent: Math.max(0, discountPercent(offer.originalPrice, offer.offerPrice)),
    href: `/offers/${encodeURIComponent(offer.id)}`,
  }))
  // The strongest percentage takes the sticker card; the first such pick on a tie.
  const strongest = features.reduce((best, f, i) => (f.percent > features[best].percent ? i : best), 0)
  const [sticker] = features.splice(strongest, 1)
  features.splice(2, 0, sticker)
  return features
}

/** What's inside on the guest home: a pillar groups real business categories, or none (Community: mentoring, not a catalogue). */
export interface ValuePillar {
  key: 'dining' | 'lifestyle' | 'experiences' | 'community'
  categories: readonly CategoryTile['category'][]
}

export const VALUE_PILLARS: readonly ValuePillar[] = [
  { key: 'dining', categories: ['Restaurants and Cafes'] },
  { key: 'lifestyle', categories: ['Fashion and Shopping', 'Beauty and Skincare', 'Home and Furnishing', 'Kids and Baby', 'Pampering Bundles', 'Sport and Fitness'] },
  { key: 'experiences', categories: ['Attractions and Tours', 'Beach and Sea', 'Israel and Global Tourism'] },
  { key: 'community', categories: [] },
]

/** Where a pillar's card leads: its one category, the catalogue, or /olim for Community. */
export function pillarHref(pillar: ValuePillar): string {
  if (pillar.categories.length === 0) return '/olim'
  return pillar.categories.length === 1 ? categoryHref(pillar.categories[0]) : '/categories'
}

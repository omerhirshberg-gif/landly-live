import { CATEGORY_TILES, type CategoryTile } from '@/lib/categories'
import { isOfferAvailable, isOfferNew, sortFeaturedOffers, type OfferDocument } from '@/lib/firebase/offers'
import type { TranslationKey } from '@/lib/i18n/translations'
import { compareFeatured } from '@/lib/perks/perksFilter'

// The member home's catalog, shared by the website (LoggedInHome) and the Expo
// Home tab: pure functions over the one fetched offer list. A category gets a
// rail only while it holds a claimable offer, so empty and sold-out categories
// never show, and a category mounts by itself once it gets its first offer.

export const CURATED_COUNT = 8
export const RAIL_MAX = 12

export interface CategoryRailGroup {
  /** The category as stored on its offers. */
  category: string
  /** Its tile, or null for a stored category outside the official list. */
  tile: CategoryTile | null
  /** Claimable offers, featured first, at most RAIL_MAX. */
  offers: OfferDocument[]
  /** Every unexpired offer in the category: what its "See all" opens. */
  total: number
}

const TILE_ORDER = new Map<string, number>(CATEGORY_TILES.map((tile, index) => [tile.category, index]))

// Rails keep the official category order, so they don't jump as counts change;
// categories outside it follow, by name.
function compareRails(a: CategoryRailGroup, b: CategoryRailGroup): number {
  const order = (rail: CategoryRailGroup) => TILE_ORDER.get(rail.category) ?? CATEGORY_TILES.length
  return order(a) - order(b) || a.category.localeCompare(b.category)
}

export function buildCategoryRails(offers: readonly OfferDocument[]): CategoryRailGroup[] {
  const rails = new Map<string, CategoryRailGroup>()
  for (const offer of [...offers].sort(compareFeatured)) {
    if (!offer.category.trim()) continue
    const rail = rails.get(offer.category) ?? {
      category: offer.category,
      tile: CATEGORY_TILES.find((tile) => tile.category === offer.category) ?? null,
      offers: [],
      total: 0,
    }
    rail.total += 1
    if (isOfferAvailable(offer) && rail.offers.length < RAIL_MAX) rail.offers.push(offer)
    rails.set(offer.category, rail)
  }
  return [...rails.values()].filter((rail) => rail.offers.length > 0).sort(compareRails)
}

/** "Recommended for you": the featured claimable offers. */
export function selectCurated(offers: readonly OfferDocument[]): OfferDocument[] {
  return offers.filter(isOfferAvailable).sort(compareFeatured).slice(0, CURATED_COUNT)
}

/**
 * "New on GoLandly" and "Best Sellers", on Home as on the Perks tab: claimable
 * offers only, bestsellers then newest first, each capped like a category rail.
 */
export function selectHighlights(offers: readonly OfferDocument[]): { newOffers: OfferDocument[]; bestsellerOffers: OfferDocument[] } {
  const available = sortFeaturedOffers(offers.filter(isOfferAvailable))
  return {
    newOffers: available.filter((offer) => isOfferNew(offer.createdAt)).slice(0, RAIL_MAX),
    bestsellerOffers: available.filter((offer) => offer.isBestseller).slice(0, RAIL_MAX),
  }
}

/** The category's translated name, or its stored name outside the official list. */
export function railLabel(rail: CategoryRailGroup, t: (key: TranslationKey) => string): string {
  return rail.tile ? t(rail.tile.labelKey) : rail.category
}

/** The pass card's line: one voucher reads in the singular. */
export function passCountMessage(count: number, t: (key: TranslationKey) => string): string {
  return count === 1 ? t('home_vouchers_message_one') : t('home_vouchers_message').replace('{count}', String(count))
}

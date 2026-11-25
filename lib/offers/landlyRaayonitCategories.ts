// Which Raayonit categories answer each GoLandly category: a category with no direct deal yet points members at the businesses that accept the
// Raayonit Card today. Pure and shared by the website and the Expo app; counts come from the live offers, so DEV and PROD stay consistent.
import type { OfferDocument } from '../firebase/offers'
import { chainsByCategory } from './discoverTab'
import { RAAYONIT_HUB } from './offerRoutes'
import { isRaayonitCategoryId, type RaayonitCategoryId } from './raayonitCategories'

/** GoLandly category -> Raayonit categories. Categories with no counterpart are left out on purpose (the fallback is every business). */
export const LANDLY_TO_RAAYONIT: Readonly<Record<string, readonly RaayonitCategoryId[]>> = {
  'Restaurants and Cafes': ['cafes-restaurants', 'cafe-cafe', 'pizza-agvania', 'pizza-story', 'biscotti', 'mr-pretzels', 'all-tastes', 'basher'],
  'Chef Restaurants': ['chef-restaurants'],
  'Attractions and Tours': ['attractions', 'cinemas'],
  'Fashion and Shopping': ['luggage-gadgets-home', 'jewelry'],
  'Israel and Global Tourism': ['hotels', 'soldier-traveler'],
  'Pampering Bundles': ['spa', 'hotels'],
  'Beauty and Skincare': ['beauty-lifestyle', 'spa'],
  'Home and Furnishing': ['luggage-gadgets-home'],
}

export const raayonitIdsFor = (landlyCategory: string): readonly RaayonitCategoryId[] => LANDLY_TO_RAAYONIT[landlyCategory] ?? []

/** `?category=` on the Raayonit hub: one id, or several separated by commas. Unknown ids are dropped. */
export const parseRaayonitScope = (raw: string | null | undefined): RaayonitCategoryId[] =>
  [...new Set((raw ?? '').split(',').map((s) => s.trim()).filter(isRaayonitCategoryId))]

/** The hub link for a list of categories (a single id is the hub's ordinary category link). */
export const raayonitScopeHref = (ids: readonly RaayonitCategoryId[]): string => (ids.length ? `${RAAYONIT_HUB}?category=${encodeURIComponent(ids.join(','))}` : RAAYONIT_HUB)

/** The GoLandly category whose mapping is exactly these ids (to name the hub's scope), or null. */
export function landlyCategoryForIds(ids: readonly RaayonitCategoryId[]): string | null {
  const key = [...ids].sort().join()
  return Object.keys(LANDLY_TO_RAAYONIT).find((c) => [...LANDLY_TO_RAAYONIT[c]].sort().join() === key) ?? null
}

/** How many distinct chains the ids hold, and the scope to open: the mapped categories while they hold chains, else every business. */
export function raayonitTargetFor(chains: readonly OfferDocument[], landlyCategory: string, lang = 'en'): { ids: RaayonitCategoryId[]; count: number; matched: boolean } {
  const groups = chainsByCategory(chains, lang, { membership: true })
  const wanted = raayonitIdsFor(landlyCategory)
  const distinct = (list: typeof groups) => new Set(list.flatMap((g) => g.offers.map((o) => o.id))).size
  const hit = groups.filter((g) => wanted.includes(g.id))
  if (hit.length > 0) return { ids: [...wanted], count: distinct(hit), matched: true }
  return { ids: [], count: distinct(groups), matched: false }
}

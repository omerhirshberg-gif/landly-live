import { CATEGORY_TILES, type CategoryTile } from '@/lib/categories'
import type { OfferDocument } from '@/lib/firebase/offers'
import type { Lang, TranslationKey } from '@/lib/i18n/translations'
import { CONTENT_LANGS, localizeText } from '@/lib/i18n/contentTranslation'
import { haversineDistanceKm, type Coordinates } from '@/lib/geo'
import { businessNameVariants } from '@/lib/business/businessText'

// The perks filter & sort pipeline shared by the website (/categories) and
// the Expo Perks tab: pure functions only (no React, no Firebase), so both
// apps run the same matching and ordering over their fetched offer lists.

export const PERK_SORTS = ['recommended', 'savings', 'newest', 'az'] as const
export type PerkSort = (typeof PERK_SORTS)[number]
export const DEFAULT_PERK_SORT: PerkSort = 'recommended'

export const PERK_SORT_LABELS: Record<PerkSort, TranslationKey> = {
  recommended: 'cats_sort_recommended',
  savings: 'cats_sort_savings',
  newest: 'cats_sort_newest',
  az: 'cats_sort_az',
}

export type CategoryFilter = 'all' | CategoryTile['category']

type Translate = (key: TranslationKey) => string

// URL / route params are user-editable: anything unknown falls back to the default.
export function parsePerkSort(raw: string | null | undefined): PerkSort {
  return (PERK_SORTS as readonly string[]).includes(raw ?? '') ? (raw as PerkSort) : DEFAULT_PERK_SORT
}

// Forgiving about how a hand-edited or shared link spells the category
// (`Beach+and+Sea` arrives undecoded on native, `beach and sea `), but it
// always returns the canonical name, so the chips compare exact values.
const categoryKey = (value: string) => value.replace(/\+/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase()
const CATEGORY_BY_KEY = new Map<string, CategoryTile['category']>(CATEGORY_TILES.map((tile) => [categoryKey(tile.category), tile.category]))

export function parseCategoryFilter(raw: string | null | undefined): CategoryFilter {
  return (raw && CATEGORY_BY_KEY.get(categoryKey(raw))) || 'all'
}

// The website's link to one category: /categories with that chip selected.
export function categoryHref(category: CategoryTile['category']): string {
  return `/categories?${new URLSearchParams({ cat: category })}`
}

export function normalizeQuery(query: string): string {
  return query.trim().toLowerCase()
}

const LABEL_KEY_BY_CATEGORY = new Map<string, TranslationKey>(CATEGORY_TILES.map((tile) => [tile.category, tile.labelKey]))

const asLang = (locale: string | undefined): Lang | null => ((CONTENT_LANGS as readonly string[]).includes(locale ?? '') ? (locale as Lang) : null)

/** The title as the reader sees it: its translation in `locale` when there is one. */
function shownTitle(offer: OfferDocument, locale: string | undefined): string {
  const lang = asLang(locale)
  return lang ? localizeText(offer.title, offer.translations, lang, 'title').text : offer.title
}

// Title (as written and in the reader's language), merchant (in every
// language it's stored in, so "Miznonki" finds "מזנונקי"), and the
// category in both its stored English name and the reader's language, so
// "חוף" finds Beach and Sea offers and "massage" finds a perk written in
// Hebrew. `normalizedQuery` is already trimmed and lower-cased; `t` and
// `locale` are optional for callers without them (the stored text still matches).
export function offerMatchesSearch(offer: OfferDocument, normalizedQuery: string, t?: Translate, locale?: string): boolean {
  if (!normalizedQuery) return true
  const labelKey = t ? LABEL_KEY_BY_CATEGORY.get(offer.category) : undefined
  return (
    offer.title.toLowerCase().includes(normalizedQuery) ||
    (!!locale && shownTitle(offer, locale).toLowerCase().includes(normalizedQuery)) ||
    businessNameVariants(offer).some((name) => name.toLowerCase().includes(normalizedQuery)) ||
    offer.category.toLowerCase().includes(normalizedQuery) ||
    (!!labelKey && !!t && t(labelKey).toLowerCase().includes(normalizedQuery))
  )
}

// No manual percentage field anywhere — always derived from the two prices.
export function discountPercent(originalPrice: number, offerPrice: number): number {
  if (originalPrice <= 0) return 0
  return Math.round((1 - offerPrice / originalPrice) * 100)
}

const createdTime = (offer: OfferDocument) => offer.createdAt?.getTime() ?? 0

// Bestsellers first, then newest — the "Recommended" order.
export function compareFeatured(a: OfferDocument, b: OfferDocument): number {
  return Number(b.isBestseller) - Number(a.isBestseller) || createdTime(b) - createdTime(a)
}

// Biggest percentage off first; equal percentages put the larger ₪ saving first.
function compareSavings(a: OfferDocument, b: OfferDocument): number {
  return (
    discountPercent(b.originalPrice, b.offerPrice) - discountPercent(a.originalPrice, a.offerPrice) ||
    b.originalPrice - b.offerPrice - (a.originalPrice - a.offerPrice)
  )
}

// Offers without a createdAt (they predate the field) sort last.
function compareNewest(a: OfferDocument, b: OfferDocument): number {
  return createdTime(b) - createdTime(a)
}

export function sortPerks(offers: readonly OfferDocument[], sort: PerkSort, locale = 'en'): OfferDocument[] {
  const sorted = [...offers]
  switch (sort) {
    case 'savings':
      return sorted.sort(compareSavings)
    case 'newest':
      return sorted.sort(compareNewest)
    case 'az': {
      const collator = new Intl.Collator(locale, { sensitivity: 'base', numeric: true })
      return sorted.sort((a, b) => collator.compare(shownTitle(a, locale), shownTitle(b, locale)))
    }
    default:
      return sorted.sort(compareFeatured)
  }
}

export interface PerkFilters {
  query: string
  category: CategoryFilter
  sort: PerkSort
}

/** Kilometres from `origin` to the offer's business, or null when it has no coordinates (online-only, not geocoded). */
export function offerDistanceKm(offer: Pick<OfferDocument, 'geo'>, origin: Coordinates | null | undefined): number | null {
  return origin && offer.geo ? haversineDistanceKm(origin, offer.geo) : null
}

/**
 * Nearest first; offers with no location keep their order after them.
 * Stable, so equal distances (one business, several perks) stay featured-first.
 */
export function sortByNearest(offers: readonly OfferDocument[], origin: Coordinates): OfferDocument[] {
  return offers
    .map((offer, index) => ({ offer, index, distance: offerDistanceKm(offer, origin) }))
    .sort((a, b) => {
      if (a.distance === null || b.distance === null) return (a.distance === null ? 1 : 0) - (b.distance === null ? 1 : 0) || a.index - b.index
      return a.distance - b.distance || a.index - b.index
    })
    .map(({ offer }) => offer)
}

// Category → search → sort, on a copy (the input list is never mutated).
// With a location (Near me, or an area picked instead), Recommended becomes
// nearest-first; an explicit sort the member chose still wins.
export function filterAndSortPerks(
  offers: readonly OfferDocument[],
  { query, category, sort }: PerkFilters,
  t?: Translate,
  locale?: string,
  origin?: Coordinates | null
): OfferDocument[] {
  const normalizedQuery = normalizeQuery(query)
  const matched = offers.filter(
    (offer) => (category === 'all' || offer.category === category) && offerMatchesSearch(offer, normalizedQuery, t, locale)
  )
  const sorted = sortPerks(matched, sort, locale)
  return origin && sort === DEFAULT_PERK_SORT ? sortByNearest(sorted, origin) : sorted
}

// True once anything moves the view off the resting overview.
export function hasActivePerkFilters({ query, category, sort }: PerkFilters): boolean {
  return normalizeQuery(query) !== '' || category !== 'all' || sort !== DEFAULT_PERK_SORT
}

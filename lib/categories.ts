import { TranslationKey } from '@/lib/i18n/translations'

// Mirrors the real category tiles shown to customers on app/categories/page.tsx
// (excluding the two dynamic tiles, "New" and "Bestsellers", which aren't
// real categories) -- kept in sync manually since that page's list is
// i18n-keyed rather than a shared exported constant.
export const BUSINESS_CATEGORIES = [
  'Restaurants and Cafes',
  'Beach and Sea',
  'Attractions and Tours',
  'Fashion and Shopping',
  'Sport and Fitness',
  'Israel and Global Tourism',
  'Pampering Bundles',
  'Beauty and Skincare',
  'Home and Furnishing',
  'Kids and Baby',
  'Insurance and Savings',
  'Cars and Transport',
] as const

// The rail's photos, 960×600 crops from Unsplash (https://unsplash.com/license),
// by images.unsplash.com id: restaurants 1517248135467-4c7edcad34c4, beach
// 1507525428034-b723cf961d3e, attractions 1513889961551-628c1e5e2ee9, fashion
// 1441986300917-64674bd600d8, sport 1534438327276-14e5300c3a48, tourism
// 1533105079780-92b9be482077, pampering 1544161515-4ab6ce6db874, beauty
// 1596462502278-27bfdc403348, home 1586023492125-27b2c045efd7, kids
// 1515488042361-ee00e0ddd4e4, insurance 1579621970795-87facc2f976d, cars
// 1449965408869-eaa3f722e40d.
export interface CategoryTile {
  category: (typeof BUSINESS_CATEGORIES)[number]
  labelKey: TranslationKey
  /** The Expo app's tile glyph; the website draws components/ui/CategoryIcon.tsx instead. */
  emoji: string
  /** The rail's lifestyle photo: public/categories/{photo}.webp, and the same file in landly-mobile/assets/categories/ (src/lib/categoryPhotos.ts). */
  photo: string
}

// Single source of truth pairing each real category with its display label
// and emoji (the app), shared by app/categories/page.tsx (tile grid) and
// the /categories chip rail and lib/perks/perksFilter.ts so they can't drift.
export const CATEGORY_TILES: CategoryTile[] = [
  { category: 'Restaurants and Cafes', labelKey: 'row_restaurants', emoji: '🍽️', photo: 'restaurants' },
  { category: 'Beach and Sea', labelKey: 'row_beach', emoji: '🏖️', photo: 'beach' },
  { category: 'Attractions and Tours', labelKey: 'cats_attractions_tours', emoji: '🎯', photo: 'attractions' },
  { category: 'Fashion and Shopping', labelKey: 'row_fashion', emoji: '👗', photo: 'fashion' },
  { category: 'Sport and Fitness', labelKey: 'row_sport', emoji: '💪', photo: 'sport' },
  { category: 'Israel and Global Tourism', labelKey: 'row_tourism', emoji: '🏨', photo: 'tourism' },
  { category: 'Pampering Bundles', labelKey: 'row_bundles', emoji: '🥂', photo: 'pampering' },
  { category: 'Beauty and Skincare', labelKey: 'row_beauty', emoji: '💄', photo: 'beauty' },
  { category: 'Home and Furnishing', labelKey: 'cats_home', emoji: '🏠', photo: 'home' },
  { category: 'Kids and Baby', labelKey: 'cats_kids', emoji: '👶', photo: 'kids' },
  { category: 'Insurance and Savings', labelKey: 'cats_insurance', emoji: '📊', photo: 'insurance' },
  { category: 'Cars and Transport', labelKey: 'cats_cars', emoji: '🚗', photo: 'cars' },
]

// How many offers each category holds, for the grid's "X perks available"
// line. Structural input so web and native can pass their OfferDocument lists.
export function countOffersByCategory(offers: readonly { category: string }[]): Map<string, number> {
  const counts = new Map<string, number>()
  for (const offer of offers) counts.set(offer.category, (counts.get(offer.category) ?? 0) + 1)
  return counts
}

// Categories whose translated label (or stored English name) contains the
// already-normalized query; an empty query keeps them all.
export function filterCategoryTiles(
  tiles: readonly CategoryTile[],
  normalizedQuery: string,
  t: (key: TranslationKey) => string
): CategoryTile[] {
  if (!normalizedQuery) return [...tiles]
  return tiles.filter(
    (tile) => t(tile.labelKey).toLowerCase().includes(normalizedQuery) || tile.category.toLowerCase().includes(normalizedQuery)
  )
}

// The card subtitle: an empty category reads "Coming soon" rather than "0 perks".
export function perksCountLabel(count: number, t: (key: TranslationKey) => string): string {
  if (count === 0) return t('cats_coming_soon')
  if (count === 1) return t('cats_perks_count_one')
  return t('cats_perks_count').replace('{count}', String(count))
}

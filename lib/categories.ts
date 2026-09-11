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

export interface CategoryTile {
  category: (typeof BUSINESS_CATEGORIES)[number]
  labelKey: TranslationKey
  emoji: string
}

// Single source of truth pairing each real category with its display label
// and emoji, shared by app/categories/page.tsx (tile grid) and
// app/categories/[category]/page.tsx (detail header) so the two can't drift.
export const CATEGORY_TILES: CategoryTile[] = [
  { category: 'Restaurants and Cafes', labelKey: 'row_restaurants', emoji: '🍽️' },
  { category: 'Beach and Sea', labelKey: 'row_beach', emoji: '🏖️' },
  { category: 'Attractions and Tours', labelKey: 'cats_attractions_tours', emoji: '🎯' },
  { category: 'Fashion and Shopping', labelKey: 'row_fashion', emoji: '👗' },
  { category: 'Sport and Fitness', labelKey: 'row_sport', emoji: '💪' },
  { category: 'Israel and Global Tourism', labelKey: 'row_tourism', emoji: '🏨' },
  { category: 'Pampering Bundles', labelKey: 'row_bundles', emoji: '🥂' },
  { category: 'Beauty and Skincare', labelKey: 'row_beauty', emoji: '💅' },
  { category: 'Home and Furnishing', labelKey: 'cats_home', emoji: '🏠' },
  { category: 'Kids and Baby', labelKey: 'cats_kids', emoji: '👶' },
  { category: 'Insurance and Savings', labelKey: 'cats_insurance', emoji: '📊' },
  { category: 'Cars and Transport', labelKey: 'cats_cars', emoji: '🚗' },
]

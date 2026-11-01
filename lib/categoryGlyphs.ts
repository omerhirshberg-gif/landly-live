import type { BUSINESS_CATEGORIES } from '@/lib/categories'

type Category = (typeof BUSINESS_CATEGORIES)[number]

// The soft fill behind each category's icon on Home's pills, a pale tone of
// what the category is about, so the row reads as colour at a glance. Pale
// steps of Tailwind's palette, so any icon stays clear on top.
export const CATEGORY_TINTS: Record<Category, string> = {
  'Restaurants and Cafes': '#ffedd5', // orange: warm, food
  'Beach and Sea': '#cffafe', // cyan: water
  'Attractions and Tours': '#fce7f3', // pink: fun
  'Fashion and Shopping': '#ede9fe', // violet
  'Sport and Fitness': '#dcfce7', // green: energy
  'Israel and Global Tourism': '#dbeafe', // blue: sky
  'Pampering Bundles': '#fae8ff', // fuchsia: spa
  'Beauty and Skincare': '#ffe4e6', // rose
  'Home and Furnishing': '#fef3c7', // amber: cosy
  'Kids and Baby': '#fef9c3', // yellow: playful
  'Insurance and Savings': '#e0e7ff', // indigo: trust
  'Cars and Transport': '#ccfbf1', // teal
}

/** An unknown category's tint. */
export const FALLBACK_TINT = '#e2e8f0'

export function categoryTint(category: string): string {
  return CATEGORY_TINTS[category as Category] ?? FALLBACK_TINT
}

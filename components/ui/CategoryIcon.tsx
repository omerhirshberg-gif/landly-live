import { Armchair, Baby, Car, Compass, createLucideIcon, Dumbbell, Plane, ShieldCheck, ShoppingBag, Tag, TreePalm, UtensilsCrossed, Wine, type LucideIcon } from 'lucide-react'

// Beauty and Skincare: a lipstick, since Lucide has no cosmetics glyph (its
// Sparkles read as "new" or "magic", not makeup). Drawn on Lucide's 24px grid
// with its round caps and joins, so it takes the same stroke width, colour
// and frame as the rest: a tube base, its collar, and the bullet cut at an
// angle. Upright, so it doesn't mirror in Hebrew.
export const Lipstick = createLucideIcon('lipstick', [
  ['path', { d: 'M5.5 22h13v-7.5a1 1 0 0 0-1-1h-11a1 1 0 0 0-1 1z', key: 'tube' }],
  ['path', { d: 'M7 13.5v-3h10v3', key: 'collar' }],
  ['path', { d: 'M9 10.5V5l6-3v8.5', key: 'bullet' }],
])

// Each business category's glyph (lib/categories.ts): Lucide outlines on a
// 24px grid, drawn in currentColor, so a tile sets the colour and size and
// every surface (the category grid, Home's rail, the hero cards) draws the
// same set. A fine 1.5 stroke by default; nothing here is directional, so no
// glyph mirrors in Hebrew. The Expo app draws the same set (landly-mobile/src/components/CategoryIcon.tsx).
export const CATEGORY_ICONS: Record<string, LucideIcon> = {
  'Restaurants and Cafes': UtensilsCrossed,
  'Beach and Sea': TreePalm,
  'Attractions and Tours': Compass,
  'Fashion and Shopping': ShoppingBag,
  'Sport and Fitness': Dumbbell,
  'Israel and Global Tourism': Plane,
  'Pampering Bundles': Wine,
  'Beauty and Skincare': Lipstick,
  'Home and Furnishing': Armchair,
  'Kids and Baby': Baby,
  'Insurance and Savings': ShieldCheck,
  'Cars and Transport': Car,
}

/** A category's glyph as a component, e.g. for IconFrame; a tag for an unknown category. */
export const categoryIcon = (category: string): LucideIcon => CATEGORY_ICONS[category] ?? Tag

export default function CategoryIcon({ category, className = 'h-5 w-5', strokeWidth = 1.5 }: { category: string; className?: string; strokeWidth?: number }) {
  const Icon = categoryIcon(category)
  return <Icon aria-hidden="true" focusable="false" className={className} strokeWidth={strokeWidth} />
}

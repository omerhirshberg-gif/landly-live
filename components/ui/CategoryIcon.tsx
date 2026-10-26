import { Baby, CarFront, Compass, createLucideIcon, Dumbbell, Plane, ShieldCheck, ShoppingBag, Sofa, Tag, TreePalm, Utensils, Wine, type LucideIcon } from 'lucide-react'

// Beauty and Skincare: a lipstick, since Lucide has no cosmetics glyph (its
// Sparkles read as "new" or "magic", not makeup). Drawn on Lucide's 24px grid
// with its round caps and joins, so it takes the same stroke width, colour
// and frame as the rest: a tube base, its collar, and the bullet cut at an
// angle. Upright, so it doesn't mirror in Hebrew.
export const Lipstick = createLucideIcon('lipstick', [
  ['path', { d: 'M7 14h10v6a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2z', key: 'tube' }],
  ['path', { d: 'M8.5 14v-3h7v3', key: 'collar' }],
  ['path', { d: 'M10 11V6l4-3v8', key: 'bullet' }],
])

// Each business category's glyph (lib/categories.ts): Lucide outlines on a
// 24px grid, drawn in currentColor, so a tile sets the colour and size and
// every surface (the category grid, Home's rail, the hero cards) draws the
// same set. A fine 1.75 stroke by default; nothing here is directional, so no
// glyph mirrors in Hebrew. The Expo app keeps its emoji for now (💄 for Beauty).
export const CATEGORY_ICONS: Record<string, LucideIcon> = {
  'Restaurants and Cafes': Utensils,
  'Beach and Sea': TreePalm,
  'Attractions and Tours': Compass,
  'Fashion and Shopping': ShoppingBag,
  'Sport and Fitness': Dumbbell,
  'Israel and Global Tourism': Plane,
  'Pampering Bundles': Wine,
  'Beauty and Skincare': Lipstick,
  'Home and Furnishing': Sofa,
  'Kids and Baby': Baby,
  'Insurance and Savings': ShieldCheck,
  'Cars and Transport': CarFront,
}

/** A category's glyph as a component, e.g. for IconFrame; a tag for an unknown category. */
export const categoryIcon = (category: string): LucideIcon => CATEGORY_ICONS[category] ?? Tag

export default function CategoryIcon({ category, className = 'h-5 w-5', strokeWidth = 1.75 }: { category: string; className?: string; strokeWidth?: number }) {
  const Icon = categoryIcon(category)
  return <Icon aria-hidden="true" focusable="false" className={className} strokeWidth={strokeWidth} />
}

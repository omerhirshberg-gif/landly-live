import type { BUSINESS_CATEGORIES } from '@shared/categories'

// The app's emoji, all in one place: each category, the Perks filter's
// "All" chip, the Perks rails' headings and the My Pass tab's stats, empty
// states and pass marks, drawn by the platform's own
// emoji font (Apple Color Emoji on iOS, Noto Color Emoji on Android) through
// components/Emoji.tsx. Written as escapes, fully qualified: a symbol that
// predates emoji (✈, 🛡) carries U+FE0F so Android draws it in colour, never
// as a text glyph. The website draws its own vector icons instead.
// (lib/categories.ts keeps the shared tiles' `emoji`; the app reads these.)

type Category = (typeof BUSINESS_CATEGORIES)[number]

export const CATEGORY_GLYPHS: Record<Category, string> = {
  'Restaurants and Cafes': '\u{1F37D}\u{FE0F}', // 🍽️
  'Beach and Sea': '\u{1F3D6}\u{FE0F}', // 🏖️
  'Attractions and Tours': '\u{1F3A1}', // 🎡
  'Fashion and Shopping': '\u{1F6CD}\u{FE0F}', // 🛍️
  'Sport and Fitness': '\u{1F3CB}\u{FE0F}', // 🏋️
  'Israel and Global Tourism': '\u{2708}\u{FE0F}', // ✈️
  'Pampering Bundles': '\u{1F9D6}', // 🧖
  'Beauty and Skincare': '\u{1F484}', // 💄
  'Home and Furnishing': '\u{1F6CB}\u{FE0F}', // 🛋️
  'Kids and Baby': '\u{1F9F8}', // 🧸
  'Insurance and Savings': '\u{1F6E1}\u{FE0F}', // 🛡️
  'Cars and Transport': '\u{1F697}', // 🚗
}

/** The Perks filter's "All" chip. */
export const ALL_GLYPH = '\u{2728}' // ✨

/** The Perks tab's highlight rails (OfferTileRail.tsx). */
export const RAIL_GLYPHS = {
  new: '\u{1F195}', // 🆕
  bestsellers: '\u{1F525}', // 🔥
} as const

export type RailGlyph = keyof typeof RAIL_GLYPHS

/** The My Pass tab: its stats (DashboardStats.tsx), empty states and pass cards. */
export const PASS_GLYPHS = {
  activePerks: '\u{1F39F}\u{FE0F}', // 🎟️
  redeemed: '\u{1F381}', // 🎁
  saved: '\u{1F4B0}', // 💰
  emptyActive: '\u{1F381}', // 🎁
  emptyRedeemed: '\u{1F9FE}', // 🧾
  validity: '\u{1F4C5}', // 📅
  redeemedMark: '\u{2705}', // ✅
} as const

/** An unknown category, wherever a glyph is drawn. */
export const FALLBACK_GLYPH = '\u{1F3F7}\u{FE0F}' // 🏷️

export function categoryGlyph(category: string): string {
  return CATEGORY_GLYPHS[category as Category] ?? FALLBACK_GLYPH
}

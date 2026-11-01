import type { LineIconName } from '../components/LineIcon'

// The app's non-category icons, all in one place (category glyphs live in
// components/CategoryIcon.tsx), plus the category tints it shares with the
// website (lib/categoryGlyphs.ts).

export { CATEGORY_TINTS, categoryTint } from '@shared/categoryGlyphs'

/** The Perks filter's "All" chip. */
export const ALL_ICON: LineIconName = 'sparkles'

/** The Perks tab's highlight rails (OfferTileRail.tsx). */
export const RAIL_ICONS = {
  new: 'sparkles',
  bestsellers: 'award',
} as const satisfies Record<string, LineIconName>

export type RailGlyph = keyof typeof RAIL_ICONS

/** The My Pass tab: its stats, empty states and pass cards. */
export const PASS_ICONS = {
  activePerks: 'ticket',
  redeemed: 'gift',
  saved: 'piggyBank',
  emptyActive: 'gift',
  emptyRedeemed: 'receipt',
  validity: 'calendar',
  redeemedMark: 'circleCheck',
} as const satisfies Record<string, LineIconName>

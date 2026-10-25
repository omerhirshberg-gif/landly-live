// Layout math for folded and unfolded foldables (and tablets), kept free of
// React Native so the web test suite can check it (tests/unit/mobileLayout.test.ts).
// The thresholds are the website's (lib/layout/foldable.ts), so a Galaxy Z
// Fold's inner screen gets two columns in the app and in its browser alike.
// Read through useLayout() (src/lib/useLayout.ts), never Dimensions.get: the
// window changes size when the phone folds or unfolds, and every screen
// re-lays out on the spot.
// A relative path, not @shared: the website's tsconfig and test suite read this
// file too, and only the app knows that alias.
import { COVER_MAX_WIDTH, DESKTOP_MIN_WIDTH, FOLD_MIN_WIDTH, MODAL_MAX_WIDTH, PANE_GAP } from '../../../lib/layout/foldable'

export { PANE_GAP }

/**
 * - cover: a folded phone's outer screen (under 380pt): tighter gutters, one column.
 * - phone: an ordinary phone, as the app has always been laid out.
 * - unfolded: a foldable's inner screen or a small tablet (600-1023pt): two columns.
 * - tablet: 1024pt and up: three columns.
 */
export type FormFactor = 'cover' | 'phone' | 'unfolded' | 'tablet'

/** The gap between grid cells, across and down (the feeds' 12pt card spacing). */
export const GRID_GAP = 12

/** The widest the member column grows (web: max-w-member). */
export const CONTENT_MAX_WIDTH = 1240

/** A single-card screen (the voucher pass, the offer, sign-in) stops growing here. */
export const READING_MAX_WIDTH = 720

export function formFactor(width: number): FormFactor {
  if (width <= COVER_MAX_WIDTH) return 'cover'
  if (width < FOLD_MIN_WIDTH) return 'phone'
  if (width < DESKTOP_MIN_WIDTH) return 'unfolded'
  return 'tablet'
}

/** The screen's side gutter: 12 on a cover screen, 16 on a phone (as before), 24 when unfolded. */
export function screenGutter(factor: FormFactor): number {
  return factor === 'cover' ? 12 : factor === 'phone' ? 16 : 24
}

/** Perk and voucher feeds: one card per row on phones, two unfolded, three on a tablet. */
export function feedColumns(factor: FormFactor): number {
  return factor === 'tablet' ? 3 : factor === 'unfolded' ? 2 : 1
}

/** The category grid: two cards per row on phones, three unfolded, four on a tablet. */
export function categoryColumns(factor: FormFactor): number {
  return factor === 'tablet' ? 4 : factor === 'unfolded' ? 3 : 2
}

/**
 * A screen's left and right padding: the side's safe-area inset (a camera
 * cutout or curved edge, which on an unfolded foldable held landscape sits at
 * one side) plus the gutter, so content always keeps the full gutter beyond
 * the system's boundary rather than resting against it. Once the content
 * reaches its cap, both sides grow equally so it sits centred in the safe
 * area. In portrait the side insets are 0 and this is just the gutter.
 * Physical sides: insets are physical, and the app flips for Hebrew with the
 * root view's direction, not I18nManager, so left stays left.
 */
export function sidePadding(
  windowWidth: number,
  gutter: number,
  insetLeft: number,
  insetRight: number,
  maxWidth = CONTENT_MAX_WIDTH
): { left: number; right: number } {
  const left = insetLeft + gutter
  const right = insetRight + gutter
  const extra = Math.max(0, (windowWidth - left - right - maxWidth) / 2)
  return { left: left + extra, right: right + extra }
}

/**
 * One grid cell's width, so a short last row keeps its cells the same size
 * instead of stretching one card across the screen. Rounded down, so the
 * cells and gaps never add up past the row.
 */
export function gridCellWidth(rowWidth: number, columns: number, gap = GRID_GAP): number {
  if (columns <= 1) return rowWidth
  return Math.floor((rowWidth - gap * (columns - 1)) / columns)
}

/**
 * Bottom sheets and dialogs: full width on phones; from 600pt a centred card
 * no wider than the website's dialogs (lib/layout/foldable.ts MODAL_MAX_WIDTH).
 */
export function sheetMaxWidth(windowWidth: number): number | undefined {
  return windowWidth >= FOLD_MIN_WIDTH ? MODAL_MAX_WIDTH : undefined
}

/** Two panes side by side (the offer, sign-in held landscape): unfolded or wider. */
export function usesPanes(factor: FormFactor): boolean {
  return factor === 'unfolded' || factor === 'tablet'
}

// The widths the website lays out foldables by, shared with tailwind.config.js
// (the `fold` screen) and app/globals.css (the cover-screen rules), and the
// same thresholds as the Expo app (landly-mobile/src/lib/layout.ts).
//
// - Cover screen: a folded phone's outer display, ~344-380px wide and very
//   tall. One column, tighter gutters, buttons stacked.
// - Unfolded: from 600px, Android's own large-screen line (sw600dp). A Galaxy
//   Z Fold's inner screen is ~700px wide, a Pixel Fold's ~840px: two columns,
//   two panes on the offer page and the sign-in screen, bounded dialogs.
// - Desktop: from 1024px (lg), unchanged.

/** The widest a folded cover screen gets; below this the layout goes compact. */
export const COVER_MAX_WIDTH = 379

/** From here a screen is laid out as an unfolded foldable (or a tablet). */
export const FOLD_MIN_WIDTH = 600

/** From here the desktop layout takes over (Tailwind lg). */
export const DESKTOP_MIN_WIDTH = 1024

/** Dialogs and modal cards stop growing here on an unfolded screen. */
export const MODAL_MAX_WIDTH = 540

/** The gutter between two panes; it sits over the fold, so no text crosses it. */
export const PANE_GAP = 24

export type WebFormFactor = 'cover' | 'phone' | 'unfolded' | 'desktop'

/** Which layout a viewport of this width gets. */
export function webFormFactor(width: number): WebFormFactor {
  if (width <= COVER_MAX_WIDTH) return 'cover'
  if (width < FOLD_MIN_WIDTH) return 'phone'
  if (width < DESKTOP_MIN_WIDTH) return 'unfolded'
  return 'desktop'
}

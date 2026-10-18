// Floating buttons (the WhatsApp widget) stay clear of whatever covers the
// bottom of the screen: the cookie bar, an offer's purchase bar while it's
// stuck to the bottom on phones. Those elements carry this attribute; the
// button rises by however much of the viewport's bottom edge they cover.

export const FLOATING_CLEARANCE_ATTR = 'data-floating-clearance'

/** The slice of an element over the viewport's bottom edge, in px: 0 unless it touches that edge. */
export function bottomCoverage(rect: { top: number; bottom: number }, viewportHeight: number): number {
  // A sub-pixel gap still counts as touching (sticky bars land on fractional positions).
  if (rect.bottom < viewportHeight - 1 || rect.top >= viewportHeight) return 0
  return Math.max(0, viewportHeight - Math.max(rect.top, 0))
}

/** How far a bottom-anchored floating button must rise: the tallest coverage among the marked elements. */
export function floatingClearance(root: ParentNode, viewportHeight: number): number {
  let lift = 0
  root.querySelectorAll(`[${FLOATING_CLEARANCE_ATTR}]`).forEach((el) => {
    lift = Math.max(lift, bottomCoverage(el.getBoundingClientRect(), viewportHeight))
  })
  return Math.round(lift)
}

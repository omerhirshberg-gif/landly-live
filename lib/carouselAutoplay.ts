// The auto-advancing "Curated for you" / "Recommended for you" row, shared by
// the website (lib/useAutoAdvance.ts) and the Expo app (components/OfferCarousel.tsx):
// one card every 5 seconds, then back to the first. It stops for a finger on
// the row, a pointer over it, focus inside it, Reduce Motion, a hidden page or
// screen, and anywhere the row has nowhere to go.

/** Time between cards. A pause restarts the whole interval, so a card is never cut short. */
export const AUTO_ADVANCE_MS = 5000

/** The resting place after `current`: the next one, or the first after the last. -1/NaN count as before the first. */
export function nextAutoIndex(current: number, count: number): number {
  if (count <= 1) return 0
  const at = Number.isFinite(current) ? Math.round(current) : -1
  return at >= count - 1 || at < -1 ? 0 : at + 1
}

// Layout math for components/OfferCarousel.tsx, kept free of React Native so
// the web test suite can check it (tests/unit/offerCarousel.test.ts).

export const CAROUSEL_GAP = 12
// The screen's gutter: the rail bleeds through it, so cards scroll out from under it.
export const CAROUSEL_EDGE = 16

/** About 72% of the screen, held between 240 and 260pt, so the next card always peeks in. */
export function carouselCardWidth(screenWidth: number): number {
  return Math.round(Math.min(260, Math.max(240, screenWidth * 0.72)))
}

/**
 * Where a swipe may come to rest: each card's start edge at the gutter, plus
 * the far end so the last card is reachable. Layout follows the root view's
 * `direction` (app/_layout.tsx), but the scroll offset is always measured
 * from the left edge, so in Hebrew the first card sits at the far right and
 * the offsets count down from the end.
 */
export function carouselSnapOffsets(count: number, interval: number, maxOffset: number, isRtl: boolean): number[] {
  const offsets = Array.from({ length: count }, (_, i) =>
    isRtl ? Math.max(0, maxOffset - i * interval) : Math.min(i * interval, maxOffset)
  )
  return [...new Set(offsets)].sort((a, b) => a - b)
}

// The Perks tab's highlight rails (components/OfferTileRail.tsx): fixed 256pt
// slots of 140pt tiles, so the New and Best Sellers rails both fit a small
// phone above the category grid.
export const TILE_RAIL_WIDTH = 256
export const TILE_RAIL_TILE_HEIGHT = 140

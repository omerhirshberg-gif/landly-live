// Layout math for components/OfferCarousel.tsx, kept free of React Native so
// the web test suite can check it (tests/unit/offerCarousel.test.ts).

export const CAROUSEL_GAP = 12
// The screen's gutter: the rail bleeds through it, so cards scroll out from under it.
export const CAROUSEL_EDGE = 16
// Past this many resting places a row of dots stops reading as a position: longer rows go without (web: SNAP_DOTS_MAX).
export const PAGER_DOTS_MAX = 8

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

/**
 * Where the row is, in resting places, for its pagination dots: 0 at the
 * first, 1 at the next, fractions between them. `starts` are the resting
 * offsets counted from the start edge (carouselSnapOffsets with isRtl false),
 * so one dot is one place a swipe can stop, and the last cards that can't
 * reach the gutter share the final dot. `fromStart` is how far the row has
 * scrolled from its start edge. A worklet: the dots follow the finger on the
 * UI thread.
 */
export function carouselPage(fromStart: number, starts: readonly number[]): number {
  'worklet'
  const last = starts.length - 1
  if (last <= 0 || fromStart <= starts[0]) return 0
  for (let i = 1; i <= last; i++) {
    if (fromStart <= starts[i]) return i - 1 + (fromStart - starts[i - 1]) / (starts[i] - starts[i - 1])
  }
  return last
}

/**
 * A card's place in the carousel's list, for FlatList's getItemLayout, so the
 * list never measures a card to know where the next one is. Each cell is its
 * card plus the gap after it (the separator renders inside the cell), the
 * last one only its card; `leading` is the row's start padding.
 */
export function carouselItemLayout(index: number, count: number, cardWidth: number, gap: number, leading: number): { length: number; offset: number; index: number } {
  return { length: index === count - 1 ? cardWidth : cardWidth + gap, offset: leading + index * (cardWidth + gap), index }
}

/** How many cards the carousel mounts first: those that fit the viewport, plus the one peeking in. */
export function carouselInitialCount(viewportWidth: number, cardWidth: number, count: number): number {
  return Math.max(1, Math.min(count, Math.ceil(viewportWidth / Math.max(1, cardWidth)) + 1))
}

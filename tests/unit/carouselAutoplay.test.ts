import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { AUTO_ADVANCE_MS, nextAutoIndex } from '@/lib/carouselAutoplay'

describe('carousel auto-advance', () => {
  it('puts New on Landly and Best Sellers on Home, on web and native, on staggered beats', () => {
    const web = readFileSync('components/home/LoggedInHome.tsx', 'utf8')
    expect(web).toContain('selectHighlights')
    expect(web).toContain('href="/categories/new"')
    expect(web).toContain('href="/categories/bestsellers"')
    expect(web).toContain('autoAdvanceOffsetMs={1500}')
    expect(web).toContain('autoAdvanceOffsetMs={3000}')
    const native = readFileSync('landly-mobile/src/app/(tabs)/index.tsx', 'utf8')
    expect(native).toContain('selectHighlights')
    expect(native).toContain("RAIL_ICONS.new")
    expect(native).toContain("RAIL_ICONS.bestsellers")
    expect(native).toContain('autoAdvanceOffsetMs={1500}')
    expect(native).toContain('autoAdvanceOffsetMs={3000}')
  })

  it('moves every 5 seconds', () => expect(AUTO_ADVANCE_MS).toBe(5000))

  it('steps to the next card and loops from the last back to the first', () => {
    expect(nextAutoIndex(0, 4)).toBe(1)
    expect(nextAutoIndex(2, 4)).toBe(3)
    expect(nextAutoIndex(3, 4)).toBe(0)
    expect(nextAutoIndex(2.6, 4)).toBe(0)
  })

  it('stays put with nothing to advance to', () => {
    expect(nextAutoIndex(0, 1)).toBe(0)
    expect(nextAutoIndex(0, 0)).toBe(0)
    expect(nextAutoIndex(NaN, 3)).toBe(0)
  })

  it('moves the Perks highlight rails too, the second two seconds behind the first, so they never jump together', () => {
    expect(readFileSync('app/categories/page.tsx', 'utf8')).toMatch(/OfferTileRail icon=\{Sparkles\}[^\n]*autoAdvance compact \/>/)
    expect(readFileSync('app/categories/page.tsx', 'utf8')).toMatch(/OfferTileRail icon=\{Award\}[^\n]*autoAdvance autoAdvanceOffsetMs=\{2000\} compact/)
    const perks = readFileSync('landly-mobile/src/app/(tabs)/perks.tsx', 'utf8')
    expect(perks).toMatch(/glyph="new"[^\n]*autoAdvance \/>/)
    expect(perks).toMatch(/glyph="bestsellers"[^\n]*autoAdvance autoAdvanceOffsetMs=\{2000\}/)
  })

  it('is wired to the curated row, on the web and in the app, and stops for touch, hover, focus and Reduce Motion', () => {
    expect(readFileSync('components/home/CuratedOffers.tsx', 'utf8')).toContain('autoAdvance')
    const hook = readFileSync('lib/useAutoAdvance.ts', 'utf8')
    for (const needle of ['AUTO_ADVANCE_MS', 'prefers-reduced-motion', 'pointerenter', 'focusin', 'touchstart', 'visibilitychange', 'IntersectionObserver', 'clearInterval']) expect(hook).toContain(needle)
    const native = readFileSync('landly-mobile/src/components/OfferCarousel.tsx', 'utf8')
    for (const needle of ['AUTO_ADVANCE_MS', 'onScrollBeginDrag', 'onMomentumScrollEnd', 'onScrollEndDrag', 'useReducedMotion', 'clearInterval', 'useFocusEffect', 'AppState']) expect(native).toContain(needle)
    expect(readFileSync('landly-mobile/src/app/(tabs)/index.tsx', 'utf8')).toMatch(/<OfferCarousel[^>]*autoAdvance/)
    // The category rails don't move by themselves.
    expect(readFileSync('landly-mobile/src/components/CategoryOfferRail.tsx', 'utf8')).not.toContain('autoAdvance')
  })
})

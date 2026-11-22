import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const read = (p: string) => readFileSync(p, 'utf8')

// The web perk cards: 260px on phones, 280px from 640px, never narrower, with a 160px 16:10 photo.
describe('web offer card size', () => {
  const card = read('components/discover/OfferCard.tsx')
  it('rail cards show 2.15 per phone screen (150-232px) and 232px from sm, with a 16:10 photo capped at 160px', () => {
    expect(card).toContain('w-[clamp(150px,calc((100vw-36px)/2.15),232px)] flex-shrink-0 sm:w-[232px]')
    expect(card).toContain("'aspect-[16/10] max-h-40'")
    expect(card).not.toMatch(/lg:max-h-\[118px\]|lg:p-2\.5|lg:text-sm/)
  })
  it('tile rails snap 2.15-per-screen then 232px tracks; every desktop rail holds 232px and never grows', () => {
    const rail = read('components/discover/OfferTileRail.tsx')
    for (const c of ['auto-cols-[clamp(150px,calc((100vw-36px)/2.15),232px)]', 'sm:auto-cols-[232px]']) expect(rail).toContain(c)
    expect(read('components/discover/OfferCardRail.tsx')).toContain("'lg:grow-0 lg:basis-[232px]'")
  })
  it('the feed grids keep a 20px gap and column counts that leave every card 260px or wider', () => {
    expect(read('components/discover/offerFeedGrid.ts')).toContain("'grid grid-cols-1 gap-5 fold:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 min-[1920px]:grid-cols-6'")
    // Narrowest card at each step: (viewport - 2 x 32px gutters - gaps) / columns.
    const narrowest = (vw: number, cols: number, gutter: number) => (vw - 2 * gutter - 20 * (cols - 1)) / cols
    expect(narrowest(1024, 3, 32)).toBeGreaterThanOrEqual(260)
    expect(narrowest(1280, 4, 32)).toBeGreaterThanOrEqual(260)
    expect(narrowest(1536, 5, 32)).toBeGreaterThanOrEqual(260)
    expect(narrowest(1920, 6, 32)).toBeGreaterThanOrEqual(260)
    expect(narrowest(600, 2, 24)).toBeGreaterThanOrEqual(260)
  })
  it('wishlist packs fixed 280px cards from the start edge', () => {
    expect(read('app/wishlist/page.tsx')).toContain('lg:grid-cols-[repeat(auto-fill,280px)] lg:justify-start')
  })
})

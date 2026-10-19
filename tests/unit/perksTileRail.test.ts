import { describe, expect, it, vi } from 'vitest'
import { createElement, type ReactElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { LangContext } from '@/lib/i18n/LangProvider'
import { RTL_LANGS, translations, type Lang, type TranslationKey } from '@/lib/i18n/translations'
vi.mock('@/lib/firebase/config', () => ({ db: {}, auth: {} }))

import { isOfferAvailable, type OfferDocument } from '@/lib/firebase/offers'
import OfferTileRail from '@/components/discover/OfferTileRail'
import PerksToolbar from '@/components/perks/PerksToolbar'
import { TILE_RAIL_TILE_HEIGHT, TILE_RAIL_WIDTH } from '../../landly-mobile/src/lib/carousel'

function render(lang: Lang, element: ReactElement) {
  const t = (key: TranslationKey) => translations[lang][key]
  const isRtl = (RTL_LANGS as readonly string[]).includes(lang)
  return renderToStaticMarkup(createElement(LangContext.Provider, { value: { lang, setLang: () => {}, t, isRtl } }, element))
}

function offer(id: string, extra: Partial<OfferDocument> = {}): OfferDocument {
  return {
    id,
    businessId: 'b',
    businessName: `Biz ${id}`,
    location: '',
    imageUrl: '',
    title: `Deal ${id}`,
    description: '',
    originalPrice: 100,
    offerPrice: 80,
    category: 'Restaurants and Cafes',
    createdAt: null,
    isBestseller: false,
    expiryDate: null,
    totalQuantity: null,
    claimedCount: 0,
    validityDays: 30,
    redemptionTerms: '',
    redemptionMethod: 'in_store',
    redemptionInstructions: '',
    ...extra,
  }
}

describe('Expo tile rail sizes', () => {
  it('matches the web rail: 256pt slots of 140pt tiles', () => {
    expect(TILE_RAIL_WIDTH).toBe(256)
    expect(TILE_RAIL_TILE_HEIGHT).toBe(140)
  })
})

describe('isOfferAvailable', () => {
  it('drops only sold-out offers', () => {
    expect(isOfferAvailable({ totalQuantity: null, claimedCount: 500 })).toBe(true)
    expect(isOfferAvailable({ totalQuantity: 10, claimedCount: 9 })).toBe(true)
    expect(isOfferAvailable({ totalQuantity: 10, claimedCount: 10 })).toBe(false)
  })
})

describe('web OfferTileRail', () => {
  const offers = ['1', '2', '3', '4', '5'].map((id) => offer(id))

  it('is one row of tiles scrolling sideways, with a hidden scrollbar and snapping', () => {
    const html = render('en', createElement(OfferTileRail, { emoji: '✨', title: 'New on Landly', offers }))
    const rail = html.match(/<div class="(offer-tile-rail[^"]*)">/)![1].split(' ')
    expect(rail).not.toContain('grid-rows-2')
    for (const c of ['grid', 'grid-flow-col', 'auto-cols-[256px]', 'sm:auto-cols-[272px]', 'overflow-x-auto', 'snap-x', 'scrollbar-none']) expect(rail).toContain(c)
    // DOM order is the reading order.
    const hrefs = [...html.matchAll(/href="\/offers\/(\d)"/g)].map((m) => m[1])
    expect(hrefs).toEqual(['1', '2', '3', '4', '5'])
  })

  it('renders compact 140px tiles with a 104px photo strip, the discount pill and both prices', () => {
    const html = render('en', createElement(OfferTileRail, { emoji: '✨', title: 'x', offers: [offer('1')] }))
    expect(html).toContain('h-[140px]')
    expect(html).toContain('w-[104px]')
    expect(html).toContain(translations.en.offer_percent_off.replace('{n}', '20'))
    expect(html).toContain('₪80')
    expect(html).toContain('line-through')
  })

  it('leaves Hebrew to the page direction, so it fills and starts from the right', () => {
    const html = render('he', createElement(OfferTileRail, { emoji: '✨', title: 'x', offers }))
    // No dir on the section or the rail: they inherit the page's.
    expect(html).toMatch(/^<section aria-labelledby="[^"]*" class="[^"]*">/)
    expect(html).toMatch(/<div class="offer-tile-rail /)
    // Chevrons mount only once the rail measures as overflowing, never on the server.
    expect(html).not.toContain('tile-rail-arrow')
  })
})

describe('PerksToolbar on the overview', () => {
  it('is the search row alone: no chips or Sort until something is chosen', () => {
    const props = { query: '', onQueryChange: () => {}, category: 'all' as const, onCategoryChange: () => {}, sort: 'recommended' as const, onSortChange: () => {}, showFilters: false }
    const html = render('en', createElement(PerksToolbar, props))
    expect(html).not.toContain('role="radiogroup"')
    expect(html).not.toContain('aria-haspopup')
  })
})

describe('/categories overview order', () => {
  it('stacks New on Landly over Best Sellers, then the full category grid', async () => {
    const { readFileSync } = await import('node:fs')
    const page = readFileSync('app/categories/page.tsx', 'utf8')
    const overview = page.slice(page.indexOf("title={t('row_new')}"))
    const newRail = overview.indexOf("title={t('row_new')}")
    const bestRail = overview.indexOf("title={t('row_bestsellers')}")
    const grid = overview.indexOf('<CategoryGrid tiles={CATEGORY_TILES}')
    expect(newRail).toBeGreaterThan(-1)
    expect(bestRail).toBeGreaterThan(newRail)
    expect(grid).toBeGreaterThan(bestRail)
    const native = readFileSync('landly-mobile/src/app/(tabs)/perks.tsx', 'utf8')
    const n = (s: string) => native.indexOf(s)
    expect(n("title={t('row_new')}")).toBeLessThan(n("title={t('row_bestsellers')}"))
    expect(n("title={t('row_bestsellers')}")).toBeLessThan(n('<CategoryGrid tiles={CATEGORY_TILES}'))
  })
})

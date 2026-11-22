import { describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { translations } from '@/lib/i18n/translations'
import { bannerFigures } from '@/lib/home/superShowcase'
import { availableRegionFilters, matchesRegionFilter, RAAYONIT_REGION_FILTERS, RAAYONIT_REGION_LABEL_KEYS, redemptionBadge, REDEMPTION_BADGE_KEYS } from '@/lib/offers/raayonitRegions'

vi.mock('@/lib/firebase/config', () => ({ db: {}, auth: {}, app: {} }))

const branch = (city: string) => ({ name: 'x', city, address: '', phone: '', kosher: false })
const venue = (cities: string[], extra: Record<string, unknown> = {}) => ({ branches: cities.map(branch), redemptionMethod: 'in_store' as const, ...extra })

describe('Raayonit region filter', () => {
  it('places a venue by its branch cities, Eilat counting as South', () => {
    expect(matchesRegionFilter(venue(['תל אביב']), 'center')).toBe(true)
    expect(matchesRegionFilter(venue(['תל אביב']), 'north')).toBe(false)
    expect(matchesRegionFilter(venue(['הרצליה']), 'sharon')).toBe(true)
    expect(matchesRegionFilter(venue(['ירושלים']), 'jerusalem')).toBe(true)
    expect(matchesRegionFilter(venue(['חיפה']), 'north')).toBe(true)
    expect(matchesRegionFilter(venue(['אילת']), 'south')).toBe(true)
  })

  it('shows a venue with no branch city under All and Nationwide only, never in a region', () => {
    const nowhere = { branches: undefined, redemptionMethod: 'in_store' as const }
    const unknownCity = venue(['עיר לא ידועה'])
    for (const v of [nowhere, unknownCity]) {
      expect(matchesRegionFilter(v, 'all')).toBe(true)
      for (const f of ['center', 'sharon', 'jerusalem', 'north', 'south'] as const) expect(matchesRegionFilter(v, f)).toBe(false)
    }
    expect(matchesRegionFilter(nowhere, 'nationwide')).toBe(true)
  })

  it('Online follows the redemption method or mode; a wide chain is nationwide', () => {
    expect(matchesRegionFilter(venue([], { redemptionMethod: 'online' }), 'online')).toBe(true)
    expect(matchesRegionFilter(venue(['תל אביב']), 'online')).toBe(false)
    expect(matchesRegionFilter(venue(['תל אביב', 'הרצליה', 'ירושלים', 'חיפה']), 'nationwide')).toBe(true)
    expect(matchesRegionFilter(venue(['תל אביב']), 'nationwide')).toBe(false)
  })

  it('hides pills with no venue, and every pill and badge has text in all five languages', () => {
    expect(availableRegionFilters([venue(['תל אביב'])])).toEqual(['all', 'center'])
    for (const lang of ['he', 'en', 'ru', 'fr', 'es'] as const) {
      for (const f of RAAYONIT_REGION_FILTERS) expect(translations[lang][RAAYONIT_REGION_LABEL_KEYS[f]]).toBeTruthy()
      for (const k of Object.values(REDEMPTION_BADGE_KEYS)) expect(translations[lang][k]).toBeTruthy()
      for (const k of ['raayonit_results', 'raayonit_banner_sub', 'raayonit_banner_cta'] as const) expect(translations[lang][k]).toBeTruthy()
    }
  })

  it('badges online, by phone and in-store', () => {
    expect(redemptionBadge({ redemptionMethod: 'online' })).toBe('online')
    for (const m of ['phone_booking', 'advance_booking', 'phone_order'] as const) expect(redemptionBadge({ redemptionMethod: m })).toBe('phone')
    expect(redemptionBadge({ redemptionMethod: 'in_store' })).toBe('in_store')
  })
})

describe('Home banner figures', () => {
  const ladder = { id: 'f', variants: [{ poolId: 'a', faceValueAgorot: 10000, priceAgorot: 8900 }, { poolId: 'b', faceValueAgorot: 15000, priceAgorot: 13200 }, { poolId: 'c', faceValueAgorot: 20000, priceAgorot: 17400 }] as never }
  const flagship = { id: 'f', variants: [{ poolId: 'a', faceValueAgorot: 10000, priceAgorot: 8900 }, { poolId: 'b', faceValueAgorot: 15000, priceAgorot: 12900 }] as never }
  it('reads the best discount and the chain count (down to a ten), falling back to 13 and 230', () => {
    expect(bannerFigures(flagship, 237)).toEqual({ percent: 14, count: 230 })
    expect(bannerFigures(ladder, 237)).toEqual({ percent: 13, count: 230 })
    expect(bannerFigures(null, 0)).toEqual({ percent: 13, count: 230 })
    expect(bannerFigures({ id: 'f', variants: [{ poolId: 'a', faceValueAgorot: 10000, priceAgorot: 9000 }] as never }, 45)).toEqual({ percent: 10, count: 40 })
  })
})

describe('Raayonit hub layout', () => {
  const web = readFileSync('components/raayonit/RaayonitTab.tsx', 'utf8')
  const native = readFileSync('landly-mobile/src/components/RaayonitTab.tsx', 'utf8')
  it('has one search field and a Filter button (popover or sheet), no pill rows and no verbose copy', () => {
    for (const [name, src] of [['web', web], ['native', native]]) {
      expect(src, name).toContain("t('raayonit_where_title')")
      expect(src, name).not.toContain('businesses_sub')
      expect(src, name).not.toContain('PillTrack')
    }
    expect(web).toContain('<RaayonitFilterMenu')
    expect(native).toContain('<RaayonitFilterSheet')
    for (const path of ['components/raayonit/RaayonitHero.tsx', 'landly-mobile/src/components/RaayonitHero.tsx', 'components/home/GiftCardBand.tsx']) expect(readFileSync(path, 'utf8'), path).not.toContain('products_valid_all')
  })
  it('frames every venue card in white with a hairline border', () => {
    // The card lives in its own ChainTile file, shared by the rows, the Show all popup and the search grid.
    expect(readFileSync('components/raayonit/ChainTile.tsx', 'utf8')).toContain('rounded-2xl border border-slate-200/80 bg-white')
    const nativeTile = readFileSync('landly-mobile/src/components/ChainTile.tsx', 'utf8')
    expect(nativeTile).toContain("borderRadius: 16")
    expect(nativeTile).toContain("backgroundColor: '#FFFFFF'")
  })
  it('keeps the logo backdrop to a faint wash', () => {
    expect(readFileSync('components/ui/BrandMedia.tsx', 'utf8')).toContain('opacity-[0.15]')
    expect(readFileSync('landly-mobile/src/components/BrandMedia.tsx', 'utf8')).toContain('opacity: 0.15')
  })
})

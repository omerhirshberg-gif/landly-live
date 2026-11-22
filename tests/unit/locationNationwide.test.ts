import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { applyLocationFilter, applyLocationFilterWithNationwide, isUnmappedNationwideChain, partitionByLocation, type LocationFilter } from '@/lib/perks/locationFilter'
import { locationCountLabel } from '@/lib/perks/locationCount'
import { translations } from '@/lib/i18n/translations'

const telAviv = { lat: 32.0853, lng: 34.7818 }
const gps5: LocationFilter = { kind: 'gps', coords: telAviv, radiusKm: 5 }
// Only the fields the location filter reads.
const mapped = { id: 'a', geo: { lat: 32.087, lng: 34.78 }, perkScope: 'single_business', branches: [] } as never
const farAway = { id: 'b', geo: { lat: 29.55, lng: 34.95 }, perkScope: 'single_business', branches: [] } as never
const footLocker = { id: 'c', geo: null, perkScope: 'single_business', fulfillmentType: 'raayonit_pool', isNationwide: true, branches: [] } as never
const nationwideDirect = { id: 'd', geo: null, perkScope: 'single_business', fulfillmentType: 'direct_merchant', isNationwide: true, branches: [] } as never
const multiChain = { id: 'e', geo: null, perkScope: 'multi_chain', fulfillmentType: 'raayonit_pool', isNationwide: true, branches: [] } as never
const noPlaceLocal = { id: 'f', geo: null, perkScope: 'single_business', fulfillmentType: 'direct_merchant', branches: [] } as never

describe('isUnmappedNationwideChain', () => {
  it('flags nationwide and Raayonit offers with nothing to place', () => {
    expect(isUnmappedNationwideChain(footLocker)).toBe(true)
    expect(isUnmappedNationwideChain(nationwideDirect)).toBe(true)
  })
  it('leaves placed offers, multi-chain passes and plain local offers alone', () => {
    expect(isUnmappedNationwideChain(mapped)).toBe(false)
    expect(isUnmappedNationwideChain(multiChain)).toBe(false)
    expect(isUnmappedNationwideChain(noPlaceLocal)).toBe(false)
    expect(isUnmappedNationwideChain({ ...(footLocker as object), branches: [{ city: 'תל אביב', name: 'x' }] } as never)).toBe(false)
  })
})

describe('partitionByLocation', () => {
  const all = [mapped, farAway, footLocker, nationwideDirect, multiChain, noPlaceLocal]
  it('splits nearby from unmapped nationwide chains under a filter', () => {
    const { nearby, nationwide } = partitionByLocation(all, gps5)
    expect(nearby.map((o: { id: string }) => o.id)).toEqual(['a', 'e'])
    expect(nationwide.map((o: { id: string }) => o.id)).toEqual(['c', 'd'])
  })
  it('puts everything in nearby without a filter', () => {
    const { nearby, nationwide } = partitionByLocation(all, null)
    expect(nearby).toHaveLength(all.length)
    expect(nationwide).toHaveLength(0)
  })
  it('works for an area filter too', () => {
    const area: LocationFilter = { kind: 'area', region: null, city: 'תל אביב' }
    const { nearby, nationwide } = partitionByLocation(all, area)
    expect(nearby.map((o: { id: string }) => o.id)).toContain('a')
    expect(nationwide.map((o: { id: string }) => o.id)).toEqual(['c', 'd'])
  })
  it('keeps the old filter strict and the new one inclusive', () => {
    expect(applyLocationFilter(all, gps5)).toHaveLength(2)
    expect(applyLocationFilterWithNationwide(all, gps5)).toHaveLength(4)
  })
})

describe('locationCountLabel', () => {
  const t = (key: keyof (typeof translations)['en']) => translations.en[key]
  it('splits the count only when both groups exist', () => {
    expect(locationCountLabel(12, 12, t)).toBe('12 nearby · 12 nationwide')
    expect(locationCountLabel(24, 0, t)).toBe(translations.en.cats_perks_count.replace('{count}', '24'))
    expect(locationCountLabel(0, 3, t)).toBe(translations.en.cats_perks_count.replace('{count}', '3'))
  })
})

describe('location sheet copy', () => {
  const keys = ['loc_sheet_title', 'loc_near_me_title', 'loc_choose_region_city', 'loc_apply', 'loc_reset', 'loc_more_nationwide', 'loc_nationwide_badge', 'loc_split_count'] as const
  it('exists in all five languages', () => {
    for (const lang of ['he', 'en', 'ru', 'es', 'fr'] as const) for (const key of keys) expect(translations[lang][key]?.length, `${lang}.${key}`).toBeGreaterThan(1)
  })
  it('uses the agreed Hebrew and English wording', () => {
    expect(translations.he.loc_more_nationwide).toBe('רשתות ארציות נוספות המכבדות את התו')
    expect(translations.he.loc_nationwide_badge).toBe('רשת ארצית')
    expect(translations.en.loc_more_nationwide).toBe('More nationwide chains honoring this voucher')
    expect(translations.en.loc_nationwide_badge).toBe('Nationwide chain')
  })
  it('keeps both placeholders of the split count in every language', () => {
    for (const lang of ['he', 'en', 'ru', 'es', 'fr'] as const) expect(translations[lang].loc_split_count).toMatch(/\{near\}.*\{nat\}|\{nat\}.*\{near\}/)
  })
})

describe('filter menus', () => {
  it('no longer list a Brand section or location rows', () => {
    for (const file of ['components/perks/PerksFilterMenu.tsx', 'landly-mobile/src/components/FilterSheet.tsx']) {
      const src = readFileSync(file, 'utf8')
      expect(src, file).not.toContain("t('filter_brand')")
      expect(src, file).not.toContain('filter_area_title')
    }
  })
})

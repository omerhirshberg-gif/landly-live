import { describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { raayonitRows, RAAYONIT_MORE_ROW } from '@/lib/offers/raayonitRows'
import { translations } from '@/lib/i18n/translations'

vi.mock('@/lib/firebase/config', () => ({ db: {}, auth: {} }))
const group = (id: string, n: number) => ({ id, offers: Array.from({ length: n }, (_, i) => `${id}${i}`) })

describe('Raayonit hub category rows', () => {
  it('shows at most ten per row and flags "Show all" only when there are more', () => {
    const [a, b] = raayonitRows([group('spa', 23), group('hotels', 10)])
    expect(a!.offers).toHaveLength(10)
    expect(a!.hasMore).toBe(true)
    expect(a!.all).toHaveLength(23)
    expect(b!.hasMore).toBe(false)
  })
  it('gathers thin categories into one closing row instead of near-empty rows', () => {
    const rows = raayonitRows([group('chef-restaurants', 14), group('cafe-cafe', 1), group('pizza-agvania', 1), group('biscotti', 2), group('spa', 20)])
    expect(rows.map((r) => r.id)).toEqual(['chef-restaurants', 'spa', RAAYONIT_MORE_ROW])
    expect(rows[2]!.total).toBe(4)
  })
  it('drops empty categories and keeps a lone thin category as itself', () => {
    expect(raayonitRows([group('spa', 0)])).toEqual([])
    expect(raayonitRows([group('jewelry', 2)]).map((r) => r.id)).toEqual(['jewelry'])
  })
  it('names the closing row in all five languages and wires both tabs to rows and a Show all popup', () => {
    for (const lang of ['he', 'en', 'ru', 'fr', 'es'] as const) expect(translations[lang].raayonit_row_more).toBeTruthy()
    const web = readFileSync('components/raayonit/RaayonitTab.tsx', 'utf8')
    const native = readFileSync('landly-mobile/src/components/RaayonitTab.tsx', 'utf8')
    for (const src of [web, native]) for (const needle of ['raayonitRows(', 'RAAYONIT_MORE_ROW', 'onShowAll']) expect(src).toContain(needle)
    expect(web).toContain('RaayonitCategoryDialog')
    expect(native).toContain('RaayonitCategorySheet')
  })
})

describe('Raayonit hub dividers and Location filter', () => {
  it('separates category rows with a hairline and adds a Location button beside Filter on both platforms', () => {
    for (const path of ['components/raayonit/RaayonitCategoryRail.tsx', 'landly-mobile/src/components/RaayonitCategoryRail.tsx']) expect(readFileSync(path, 'utf8'), path).toContain('divider')
    for (const path of ['components/raayonit/RaayonitTab.tsx', 'landly-mobile/src/components/RaayonitTab.tsx']) {
      const src = readFileSync(path, 'utf8')
      expect(src, path).toContain('mode="region"')
      expect(src, path).toContain('divider={i > 0}')
    }
    for (const lang of ['he', 'en', 'ru', 'fr', 'es'] as const) expect(translations[lang].raayonit_location_btn).toBeTruthy()
  })
})

describe('Location filter: near me (5 km)', () => {
  const at = (city: string) => ({ branches: [{ city }] as never, city: undefined as never })
  it('keeps only venues within 5 km of the member, nearest first, and drops online or unplaced ones', async () => {
    const { nearMe, NEAR_ME_RADIUS_KM, distanceToNearestBranchKm } = await import('@/lib/offers/raayonitRegions')
    expect(NEAR_ME_RADIUS_KM).toBe(5)
    const tlv = { lat: 32.0853, lng: 34.7818 }
    const venues = [{ id: 'haifa', ...at('חיפה') }, { id: 'tlv', ...at('תל אביב') }, { id: 'gb', ...at('גבעתיים') }, { id: 'online', branches: [] as never, city: undefined as never }, { id: 'nowhere', ...at('לא קיים') }]
    expect(nearMe(venues, tlv).map((v) => v.id)).toEqual(['tlv', 'gb'])
    expect(distanceToNearestBranchKm(venues[0]!, tlv)).toBeGreaterThan(70)
    expect(distanceToNearestBranchKm(venues[3]!, tlv)).toBeNull()
  })
  it('is applied by the Near me button itself, on both platforms, and replaces the region', () => {
    for (const path of ['components/raayonit/RaayonitFilterMenu.tsx', 'landly-mobile/src/components/RaayonitFilterSheet.tsx']) {
      const src = readFileSync(path, 'utf8')
      expect(src, path).toContain("region: 'all', near: coords")
      expect(src, path).not.toContain('regionFilterNear')
    }
    for (const path of ['components/raayonit/RaayonitTab.tsx', 'landly-mobile/src/components/RaayonitTab.tsx']) expect(readFileSync(path, 'utf8'), path).toContain('nearMe(offers, near)')
  })
})

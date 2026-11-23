import { describe, expect, it } from 'vitest'
import membership from '@/lib/offers/raayonitCategoryMembership.json'
import { RAAYONIT_CATEGORY_IDS, RAAYONIT_CATEGORY_NAMES, SECTION_CATEGORY_ID, raayonitCategoriesOf, raayonitCategoryOf } from '@/lib/offers/raayonitCategories'
import { chainsByCategory } from '@/lib/offers/discoverTab'
import { bundledCatalog } from '@/lib/inventory/raayonitCatalogSync'
import { finalizeCatalog } from '@/lib/inventory/raayonitSanitize'
import byKey from '@/lib/offers/raayonitCategoryByKey.json'

const table = membership as Record<string, string[]>
const card = (key: string, brandName: string) => ({ id: `o${key}`, sourceKey: `raayonit:${key}`, brandName, fulfillmentType: 'raayonit_pool', perkScope: 'single_business', title: brandName }) as never

describe('Raayonit category membership', () => {
  it('lists the 25 businesses Raayonit shows under more than one category: 16 gain a section, 9 gain "רשתות"', () => {
    expect(Object.keys(table)).toHaveLength(25)
    const gainSection = Object.entries(table).filter(([, v]) => v[0] === 'networks')
    expect(gainSection).toHaveLength(16)
    expect(Object.values(table).filter((v) => v[0] !== 'networks').every((v) => v[1] === 'networks')).toBe(true)
  })

  it('keeps each primary category first and lists only known categories, each once', () => {
    const brands = new Map(finalizeCatalog(bundledCatalog()).map((b) => [b.key, b]))
    for (const [key, ids] of Object.entries(table)) {
      const brand = brands.get(key)!
      expect(brand, key).toBeDefined()
      expect(ids[0], key).toBe(raayonitCategoryOf({ sourceKey: `raayonit:${key}`, brandName: brand.nameHe }, byKey as Record<string, string>))
      expect(new Set(ids).size).toBe(ids.length)
      expect(ids.every((id) => (RAAYONIT_CATEGORY_IDS as readonly string[]).includes(id))).toBe(true)
    }
  })

  it('raayonitCategoriesOf adds the extra categories and leaves single-category businesses alone', () => {
    expect(raayonitCategoriesOf(card('35', 'MAX BRENNER'))).toEqual(['networks', 'cafes-restaurants'])
    expect(raayonitCategoriesOf(card('227', 'BROWN'))).toEqual(['hotels', 'networks'])
    expect(raayonitCategoriesOf(card('20', 'סבון של פעם'))).toEqual(['networks'])
    expect(raayonitCategoryOf(card('35', 'MAX BRENNER'))).toBe('networks') // the badge and Home's counts keep the primary
  })

  it('lists a business under each of its categories only when membership is asked for', () => {
    const offers = [card('35', 'MAX BRENNER'), card('20', 'סבון של פעם'), card('25', 'CaféCafé')]
    const ids = (g: ReturnType<typeof chainsByCategory>, id: string) => g.find((x) => x.id === id)?.offers.map((o) => o.id) ?? []
    const primary = chainsByCategory(offers)
    expect(ids(primary, 'cafes-restaurants')).toEqual([])
    expect(ids(primary, 'networks')).toEqual(['o35', 'o20'].sort())
    const member = chainsByCategory(offers, 'he', { membership: true })
    expect(ids(member, 'cafes-restaurants')).toEqual(['o35'])
    expect(ids(member, 'cafe-cafe')).toEqual(['o25'])
    expect(ids(member, 'networks').sort()).toEqual(['o20', 'o25', 'o35'])
  })
})

describe('Raayonit category names', () => {
  it('uses Raayonit\'s own spelling for the Pizza Agvania section', () => {
    expect(RAAYONIT_CATEGORY_NAMES['pizza-agvania'].he).toBe('פיצה - רשת פיצה עגבנייה')
  })
  it('has exactly the 18 sections Raayonit lists with rows (Spacez, section 94, has none and is skipped)', () => {
    expect(Object.keys(SECTION_CATEGORY_ID)).toHaveLength(18)
    expect(Object.keys(SECTION_CATEGORY_ID)).not.toContain('94')
    expect(RAAYONIT_CATEGORY_IDS).toHaveLength(18)
  })
})

import { describe, expect, it } from 'vitest'
import { chainsByCategory, DISCOVER_TABS, hasNoBranchTable, isChain, isFlagship, keepRaayonitFilter, landlyOffers, parseDiscoverTab } from '@/lib/offers/discoverTab'
import { RAAYONIT_CATEGORY_IDS, RAAYONIT_CATEGORY_NAMES, SECTION_CATEGORY_ID, raayonitCategoryName, raayonitCategoryOf } from '@/lib/offers/raayonitCategories'
import byKey from '@/lib/offers/raayonitCategoryByKey.json'

const o = (id: string, extra: Record<string, unknown> = {}) => ({ id, title: id, brandName: id, ...extra }) as never

describe('the 18 Raayonit categories', () => {
  it('are exactly Raayonit’s, in the page’s order, with all five languages', () => {
    expect(RAAYONIT_CATEGORY_IDS).toHaveLength(18)
    expect(RAAYONIT_CATEGORY_IDS[0]).toBe('chef-restaurants')
    expect(RAAYONIT_CATEGORY_IDS[17]).toBe('networks')
    expect(RAAYONIT_CATEGORY_NAMES['luggage-gadgets-home'].he).toBe("מזוודות, גאדג'טים, מוצרים לבית, משקפיים וצעצועים")
    for (const id of RAAYONIT_CATEGORY_IDS) for (const l of ['he', 'en', 'ru', 'fr', 'es'] as const) expect(RAAYONIT_CATEGORY_NAMES[id][l].length, `${id}/${l}`).toBeGreaterThan(1)
    expect(raayonitCategoryName('spa', 'xx')).toBe('Spa')
  })
  it('every listing section maps to one of them, and the generated key map only uses them', () => {
    for (const id of Object.values(SECTION_CATEGORY_ID)) expect(RAAYONIT_CATEGORY_IDS).toContain(id)
    for (const id of Object.values(byKey)) expect(RAAYONIT_CATEGORY_IDS as readonly string[]).toContain(id)
  })
  it('derives a card’s category: stored first, then a network number, the generated map, then a chain section', () => {
    expect(raayonitCategoryOf({ raayonitCategory: 'spa', sourceKey: 'raayonit:5' })).toBe('spa')
    expect(raayonitCategoryOf({ sourceKey: 'raayonit:177', brandName: 'סיציליאנו' })).toBe('networks')
    expect(raayonitCategoryOf({ sourceKey: 'raayonit:232', brandName: 'רשת פיצה סטורי' })).toBe('pizza-story')
    expect(raayonitCategoryOf({ sourceKey: 'raayonit:25', brandName: 'CaféCafé' })).toBe('cafe-cafe')
    expect(raayonitCategoryOf({ sourceKey: 'raayonit:l-s93' })).toBe('cafe-cafe')
    expect(raayonitCategoryOf({ sourceKey: 'raayonit:l-77' }, { 'l-77': 'hotels' })).toBe('hotels')
  })
})

describe('the two collections', () => {
  const offers = [o('own', { fulfillmentType: 'direct_merchant' }), o('flag', { fulfillmentType: 'raayonit_pool', perkScope: 'multi_chain' }),
    o('b', { fulfillmentType: 'raayonit_pool', perkScope: 'single_business', raayonitCategory: 'hotels' }), o('a', { fulfillmentType: 'raayonit_pool', perkScope: 'single_business', raayonitCategory: 'hotels' }),
    o('c', { fulfillmentType: 'raayonit_pool', perkScope: 'single_business', raayonitCategory: 'chef-restaurants' })]
  it('GoLandly shows only non-Raayonit offers; the flagship and the chains are told apart', () => {
    expect(DISCOVER_TABS).toEqual(['landly', 'raayonit'])
    expect(landlyOffers(offers).map((x: { id: string }) => x.id)).toEqual(['own'])
    expect(isFlagship(offers[1] as never)).toBe(true)
    expect(isChain(offers[1] as never)).toBe(false)
    expect(parseDiscoverTab('raayonit')).toBe('raayonit')
    expect(parseDiscoverTab('x')).toBe('landly')
  })
  it('groups chains by category in Raayonit’s order, sorted by name, without the flagship', () => {
    const groups = chainsByCategory(offers as never)
    expect(groups.map((g) => g.id)).toEqual(['chef-restaurants', 'hotels'])
    expect(groups[1]!.offers.map((x) => x.id)).toEqual(['a', 'b'])
    expect(keepRaayonitFilter('hotels', groups)).toBe('hotels')
    expect(keepRaayonitFilter('spa', groups)).toBe('all')
  })
  it('a network tile without a branch table is flagged for the “branches vary” note', () => {
    expect(hasNoBranchTable({ branches: [] } as never)).toBe(true)
    expect(hasNoBranchTable({ branches: [{ name: 'x' }] } as never)).toBe(false)
  })
})

import { describe, expect, it } from 'vitest'
import { CATEGORY_TILES } from '@/lib/categories'
import type { OfferDocument } from '@/lib/firebase/offers'
import { landlyCategoryForIds, LANDLY_TO_RAAYONIT, parseRaayonitScope, raayonitIdsFor, raayonitScopeHref, raayonitTargetFor } from '@/lib/offers/landlyRaayonitCategories'
import { RAAYONIT_CATEGORY_IDS, raayonitCategoryName, raayonitCategoryShortName } from '@/lib/offers/raayonitCategories'

const chain = (id: string, raayonitCategory: string): OfferDocument => ({ id, fulfillmentType: 'raayonit_pool', perkScope: 'single_merchant', brandName: id, raayonitCategory }) as unknown as OfferDocument

describe('GoLandly -> Raayonit category mapping', () => {
  it('only maps real GoLandly categories to real Raayonit categories', () => {
    const landly = CATEGORY_TILES.map((t) => t.category as string)
    for (const [key, ids] of Object.entries(LANDLY_TO_RAAYONIT)) {
      expect(landly).toContain(key)
      for (const id of ids) expect(RAAYONIT_CATEGORY_IDS).toContain(id)
    }
  })
  it('has no match for categories Raayonit does not cover', () => {
    expect(raayonitIdsFor('Sport and Fitness')).toEqual([])
  })
  it('round-trips a scope through the hub link', () => {
    const ids = raayonitIdsFor('Pampering Bundles')
    const href = raayonitScopeHref(ids)
    expect(parseRaayonitScope(new URL(href, 'https://x.test').searchParams.get('category'))).toEqual([...ids])
    expect(landlyCategoryForIds(ids)).toBe('Pampering Bundles')
  })
  it('drops unknown ids and duplicates', () => {
    expect(parseRaayonitScope('spa, nope ,spa,hotels')).toEqual(['spa', 'hotels'])
    expect(parseRaayonitScope(undefined)).toEqual([])
  })
})

describe('raayonitTargetFor', () => {
  const chains = [chain('a', 'cafes-restaurants'), chain('b', 'pizza-story'), chain('c', 'jewelry')]
  it('counts the businesses in the mapped categories', () => {
    expect(raayonitTargetFor(chains, 'Restaurants and Cafes')).toMatchObject({ matched: true, count: 2 })
  })
  it('falls back to every business when there is no match', () => {
    expect(raayonitTargetFor(chains, 'Cars and Transport')).toEqual({ ids: [], count: 3, matched: false })
    expect(raayonitTargetFor(chains, 'Chef Restaurants')).toMatchObject({ matched: false, count: 3 })
  })
})

describe('short pill labels', () => {
  it('shortens the long names in every language and never lengthens one', () => {
    for (const lang of ['en', 'he', 'ru', 'fr', 'es']) {
      for (const id of RAAYONIT_CATEGORY_IDS) {
        expect(raayonitCategoryShortName(id, lang).length).toBeLessThanOrEqual(raayonitCategoryName(id, lang).length)
      }
    }
    expect(raayonitCategoryShortName('basher', 'en')).toBe('Basher Fromagerie')
  })
})

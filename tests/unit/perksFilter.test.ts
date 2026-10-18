import { describe, expect, it } from 'vitest'
import { translations, TranslationKey } from '@/lib/i18n/translations'
import type { OfferDocument } from '@/lib/firebase/offers'
import { CATEGORY_TILES } from '@/lib/categories'
import {
  categoryHref,
  filterAndSortPerks,
  hasActivePerkFilters,
  offerMatchesSearch,
  parseCategoryFilter,
  parsePerkSort,
  sortPerks,
} from '@/lib/perks/perksFilter'

const tEn = (key: TranslationKey) => translations.en[key]
const tHe = (key: TranslationKey) => translations.he[key]

function offer(overrides: Partial<OfferDocument> & { id: string }): OfferDocument {
  return {
    businessId: 'b1',
    businessName: 'Biz',
    location: '',
    imageUrl: '',
    title: overrides.id,
    description: '',
    originalPrice: 100,
    offerPrice: 80,
    category: 'Restaurants and Cafes',
    createdAt: null,
    isBestseller: false,
    expiryDate: null,
    totalQuantity: null,
    claimedCount: 0,
    validityDays: 180,
    redemptionTerms: '',
    ...overrides,
  }
}

const ids = (offers: OfferDocument[]) => offers.map((o) => o.id)

describe('parsePerkSort / parseCategoryFilter', () => {
  it('accepts known values and falls back on anything else', () => {
    expect(parsePerkSort('savings')).toBe('savings')
    expect(parsePerkSort('price-asc')).toBe('recommended')
    expect(parsePerkSort(null)).toBe('recommended')
    expect(parseCategoryFilter('Beach and Sea')).toBe('Beach and Sea')
    expect(parseCategoryFilter('Spa and Sea')).toBe('all')
    expect(parseCategoryFilter('')).toBe('all')
    expect(parseCategoryFilter(undefined)).toBe('all')
  })

  it('resolves any spelling of a category to its canonical name', () => {
    expect(parseCategoryFilter('Beach+and+Sea')).toBe('Beach and Sea')
    expect(parseCategoryFilter('  beach   AND sea ')).toBe('Beach and Sea')
    expect(parseCategoryFilter('restaurants and cafes')).toBe('Restaurants and Cafes')
  })

  it('round-trips categoryHref through the URL', () => {
    for (const tile of CATEGORY_TILES) {
      const cat = new URL(categoryHref(tile.category), 'https://x.test').searchParams.get('cat')
      expect(parseCategoryFilter(cat)).toBe(tile.category)
    }
  })
})

describe('sortPerks', () => {
  it('recommended puts bestsellers first, then newest', () => {
    const list = [
      offer({ id: 'old', createdAt: new Date(2024, 0, 1) }),
      offer({ id: 'new', createdAt: new Date(2025, 0, 1) }),
      offer({ id: 'best', isBestseller: true, createdAt: new Date(2023, 0, 1) }),
    ]
    expect(ids(sortPerks(list, 'recommended'))).toEqual(['best', 'new', 'old'])
  })

  it('savings ranks by percent, breaking ties by shekels saved', () => {
    const list = [
      offer({ id: 'p20-small', originalPrice: 50, offerPrice: 40 }),
      offer({ id: 'p50', originalPrice: 100, offerPrice: 50 }),
      offer({ id: 'p20-big', originalPrice: 500, offerPrice: 400 }),
      offer({ id: 'free-orig', originalPrice: 0, offerPrice: 0 }),
    ]
    expect(ids(sortPerks(list, 'savings'))).toEqual(['p50', 'p20-big', 'p20-small', 'free-orig'])
  })

  it('newest puts undated offers last', () => {
    const list = [offer({ id: 'undated' }), offer({ id: 'a', createdAt: new Date(2024, 0, 1) }), offer({ id: 'b', createdAt: new Date(2025, 0, 1) })]
    expect(ids(sortPerks(list, 'newest'))).toEqual(['b', 'a', 'undated'])
  })

  it('az collates case-insensitively and in Hebrew', () => {
    const list = [offer({ id: 'b', title: 'banana' }), offer({ id: 'a', title: 'Apple' }), offer({ id: 'c', title: 'cherry' })]
    expect(ids(sortPerks(list, 'az', 'en'))).toEqual(['a', 'b', 'c'])
    const hebrew = [offer({ id: 'tav', title: 'תפוז' }), offer({ id: 'alef', title: 'אבטיח' }), offer({ id: 'mem', title: 'מלון' })]
    expect(ids(sortPerks(hebrew, 'az', 'he'))).toEqual(['alef', 'mem', 'tav'])
  })

  it('never mutates the input', () => {
    const list = [offer({ id: 'b', title: 'b' }), offer({ id: 'a', title: 'a' })]
    sortPerks(list, 'az')
    expect(ids(list)).toEqual(['b', 'a'])
  })
})

describe('offerMatchesSearch', () => {
  const beach = offer({ id: 'x', title: 'Sunset kayak', businessName: 'Gordon Club', category: 'Beach and Sea' })

  it('matches title, merchant and stored category', () => {
    expect(offerMatchesSearch(beach, 'kayak')).toBe(true)
    expect(offerMatchesSearch(beach, 'gordon')).toBe(true)
    expect(offerMatchesSearch(beach, 'beach')).toBe(true)
    expect(offerMatchesSearch(beach, 'pizza')).toBe(false)
  })

  it('matches the translated category label when given a translator', () => {
    const hebrewLabel = tHe('row_beach').slice(0, 3).toLowerCase()
    expect(offerMatchesSearch(beach, hebrewLabel)).toBe(false)
    expect(offerMatchesSearch(beach, hebrewLabel, tHe)).toBe(true)
  })

  it('matches everything for an empty query', () => {
    expect(offerMatchesSearch(beach, '')).toBe(true)
  })
})

describe('filterAndSortPerks', () => {
  const list = [
    offer({ id: 'beach-cheap', category: 'Beach and Sea', title: 'Surf lesson', originalPrice: 200, offerPrice: 100 }),
    offer({ id: 'beach-small', category: 'Beach and Sea', title: 'Surf board rental', originalPrice: 100, offerPrice: 90 }),
    offer({ id: 'food', category: 'Restaurants and Cafes', title: 'Surf & turf dinner' }),
  ]

  it('combines category, search and sort', () => {
    expect(ids(filterAndSortPerks(list, { query: '  SURF ', category: 'Beach and Sea', sort: 'savings' }, tEn))).toEqual([
      'beach-cheap',
      'beach-small',
    ])
    expect(ids(filterAndSortPerks(list, { query: 'surf', category: 'all', sort: 'az' }, tEn, 'en'))).toEqual([
      'food', // "Surf & turf…": punctuation collates before letters
      'beach-small',
      'beach-cheap',
    ])
  })

  it('returns nothing when the category has no match', () => {
    expect(filterAndSortPerks(list, { query: '', category: 'Kids and Baby', sort: 'recommended' })).toEqual([])
  })
})

describe('hasActivePerkFilters', () => {
  it('is false only on the resting state', () => {
    expect(hasActivePerkFilters({ query: '  ', category: 'all', sort: 'recommended' })).toBe(false)
    expect(hasActivePerkFilters({ query: 'a', category: 'all', sort: 'recommended' })).toBe(true)
    expect(hasActivePerkFilters({ query: '', category: 'Beach and Sea', sort: 'recommended' })).toBe(true)
    expect(hasActivePerkFilters({ query: '', category: 'all', sort: 'az' })).toBe(true)
  })
})

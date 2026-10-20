import { describe, expect, it } from 'vitest'
import { translations, TranslationKey } from '@/lib/i18n/translations'
import type { OfferDocument } from '@/lib/firebase/offers'
import { filterAndSortPerks, offerDistanceKm, offerMatchesSearch, sortByNearest, sortPerks } from '@/lib/perks/perksFilter'

const tEn = (key: TranslationKey) => translations.en[key]
const TEL_AVIV = { lat: 32.0853, lng: 34.7818 }

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
    redemptionMethod: 'in_store',
    redemptionInstructions: '',
    ...overrides,
  }
}

const near = offer({ id: 'near', geo: { lat: 32.08, lng: 34.78 } })
const far = offer({ id: 'far', geo: { lat: 31.77, lng: 35.21 }, isBestseller: true })
const online = offer({ id: 'online', geo: null, redemptionMethod: 'online' })

describe('Near me ordering', () => {
  it('puts the nearest first and offers without a location last', () => {
    expect(sortByNearest([online, far, near], TEL_AVIV).map((o) => o.id)).toEqual(['near', 'far', 'online'])
  })

  it('replaces Recommended with nearest-first, but never overrides a chosen sort', () => {
    const filters = { query: '', category: 'all' as const, sort: 'recommended' as const }
    expect(filterAndSortPerks([far, online, near], filters, tEn, 'en', TEL_AVIV).map((o) => o.id)).toEqual(['near', 'far', 'online'])
    expect(filterAndSortPerks([far, online, near], filters, tEn, 'en').map((o) => o.id)[0]).toBe('far')
    const az = filterAndSortPerks([far, online, near], { ...filters, sort: 'az' }, tEn, 'en', TEL_AVIV)
    expect(az.map((o) => o.id)).toEqual(['far', 'near', 'online'])
  })

  it('measures each card’s distance', () => {
    expect(offerDistanceKm(near, TEL_AVIV)).toBeLessThan(1)
    expect(offerDistanceKm(online, TEL_AVIV)).toBeNull()
    expect(offerDistanceKm(near, null)).toBeNull()
  })
})

describe('search and A–Z in the reader’s language', () => {
  const hebrew = offer({
    id: 'h',
    title: 'עיסוי זוגי',
    translations: { sourceLang: 'he', fields: { en: { title: { text: 'Couples massage', sourceHash: 'x', machine: true } } } },
  })

  it('finds a Hebrew-written perk by its English translation, and by its Hebrew text', () => {
    expect(offerMatchesSearch(hebrew, 'massage', tEn, 'en')).toBe(true)
    expect(offerMatchesSearch(hebrew, 'massage', tEn)).toBe(false)
    expect(offerMatchesSearch(hebrew, 'עיסוי', tEn, 'en')).toBe(true)
  })

  it('sorts A–Z by the title the reader sees', () => {
    const apple = offer({ id: 'a', title: 'Apple pie' })
    expect(sortPerks([apple, hebrew], 'az', 'en').map((o) => o.id)).toEqual(['a', 'h'])
    const zebra = offer({ id: 'z', title: 'Zebra' })
    expect(sortPerks([zebra, hebrew], 'az', 'en').map((o) => o.id)).toEqual(['h', 'z'])
  })
})

import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { translations } from '@/lib/i18n/translations'
import { filterAndSortPerks, hasActivePerkFilters, parseMethodFilter, parseMinDiscount } from '@/lib/perks/perksFilter'
import type { OfferDocument } from '@/lib/firebase/offers'

const offer = (over: Partial<OfferDocument>): OfferDocument =>
  ({ id: 'x', title: 'T', category: 'Beach and Sea', originalPrice: 100, offerPrice: 80, redemptionMethod: 'in_store', businessName: 'B', isBestseller: false, ...over }) as OfferDocument

const base = { query: '', category: 'all' as const, sort: 'recommended' as const }

describe('Filter menu narrowings', () => {
  const offers = [
    offer({ id: 'a', redemptionMethod: 'in_store', offerPrice: 90 }),
    offer({ id: 'b', redemptionMethod: 'online', offerPrice: 70 }),
    offer({ id: 'c', redemptionMethod: 'online', offerPrice: 40 }),
  ]
  const ids = (filters: object) => filterAndSortPerks(offers, { ...base, ...filters }).map((o) => o.id).sort()

  it('keeps everything by default', () => expect(ids({})).toEqual(['a', 'b', 'c']))
  it('narrows by redemption type', () => {
    expect(ids({ method: 'online' })).toEqual(['b', 'c'])
    expect(ids({ method: 'in_store' })).toEqual(['a'])
  })
  it('narrows by minimum discount', () => {
    expect(ids({ minDiscount: 30 })).toEqual(['b', 'c'])
    expect(ids({ minDiscount: 50 })).toEqual(['c'])
  })
  it('leaves the overview only when one is set', () => {
    expect(hasActivePerkFilters(base)).toBe(false)
    expect(hasActivePerkFilters({ ...base, method: 'online' })).toBe(true)
    expect(hasActivePerkFilters({ ...base, minDiscount: 10 })).toBe(true)
  })
  it('falls back to no narrowing for a hand-edited URL', () => {
    expect(parseMethodFilter('phone')).toBe('all')
    expect(parseMinDiscount('37')).toBe(0)
    expect(parseMinDiscount('20')).toBe(20)
  })
})

describe('Back label on the offer page', () => {
  it.each([['en', 'Back'], ['he', 'חזרה'], ['ru', 'Назад'], ['fr', 'Retour'], ['es', 'Volver']] as const)('says just "Back" in %s', (lang, text) => {
    expect(translations[lang].offer_detail_back).toBe(text)
  })
})

describe('full-width navbar', () => {
  it('spans the viewport with the page gutters, not a centred 7xl box', () => {
    const nav = readFileSync('components/layout/Navbar.tsx', 'utf8')
    expect(nav).toContain('relative w-full px-4 sm:px-6 lg:px-8 h-16')
    expect(nav).not.toContain('max-w-7xl')
  })
})

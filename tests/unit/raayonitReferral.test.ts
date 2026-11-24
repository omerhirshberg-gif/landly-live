import { describe, expect, it } from 'vitest'
import type { OfferDocument } from '@/lib/firebase/offers'
import { matchRaayonitChains, normalizeLoose, referralHeadline, referralTarget } from '@/lib/perks/raayonitReferral'

const chain = (id: string, businessName: string, he?: string) =>
  ({ id, businessName, fulfillmentType: 'raayonit_pool', perkScope: 'single_chain', businessTranslations: he ? { fields: { he: { businessName: { text: he } } } } : null }) as unknown as OfferDocument
const flagship = { id: 'f', businessName: "Patrick's Card", fulfillmentType: 'raayonit_pool', perkScope: 'multi_chain' } as unknown as OfferDocument

describe('normalizeLoose', () => {
  it('treats every apostrophe as nothing', () => {
    const forms = ["PATRICK'S", 'PATRICK’S', 'PATRICKʼS', 'PATRICK׳S', 'PATRICKS', 'patricks']
    expect(new Set(forms.map(normalizeLoose))).toEqual(new Set(['patricks']))
  })
  it('turns other punctuation into one space', () => {
    expect(normalizeLoose('Aroma - Espresso  Bar')).toBe('aroma espresso bar')
  })
})

describe('matchRaayonitChains', () => {
  const patricks = chain('p', "PATRICK'S", 'פטריקס')
  const offers = [patricks, chain('a', 'Aroma'), chain('a2', 'Aroma Express'), flagship]
  it('finds a chain by any apostrophe spelling and by its Hebrew name', () => {
    for (const q of ["PATRICK'S", 'PATRICK’S', 'PATRICKS', 'patricks', 'פטריקס']) expect(matchRaayonitChains(offers, q)).toEqual([patricks])
  })
  it('never matches the flagship, a too-short query or nothing', () => {
    expect(matchRaayonitChains(offers, 'card')).toEqual([])
    expect(matchRaayonitChains(offers, 'p')).toEqual([])
    expect(matchRaayonitChains(offers, 'zzz')).toEqual([])
  })
})

describe('referralTarget', () => {
  it('opens one match, and the hub with ?q= for several', () => {
    const a = chain('a', 'Aroma'), b = chain('b', 'Aroma Express')
    expect(referralTarget([a], 'aroma')).toEqual({ kind: 'offer', offer: a })
    expect(referralTarget([a, b], ' ar ')).toEqual({ kind: 'hub', path: '/raayonit?q=ar', query: 'ar' })
    expect(referralTarget([], 'x')).toBeNull()
  })
})

describe('referralHeadline', () => {
  it('splits around the venue', () => {
    expect(referralHeadline('{venue} and {count} more accept it', 2)).toEqual({ before: '', after: ' and 2 more accept it' })
  })
})

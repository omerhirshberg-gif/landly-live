import { describe, expect, it } from 'vitest'
import { brandNameKey, resolveChainBrands, sortBrandsByReach } from '@/lib/offers/resolveChainBrand'
import type { OfferDocument } from '@/lib/offers/offerDocument'

const offer = (id: string, over: Partial<OfferDocument>): OfferDocument => ({ id, fulfillmentType: 'raayonit_pool', perkScope: 'single_business', ...over }) as OfferDocument
const holmes = offer('h', { brandName: 'HOLMES PLACE', businessLogoUrl: '', imageUrl: '/images/raayonit-brands/4.png', chainsCount: 8 })
const cafe = offer('c', { brandName: 'CaféCafé', imageUrl: '/images/raayonit-brands/25.png', chainsCount: 42, logoKind: 'photo' })
const sabon = offer('s', { brandName: 'סבון של פעם', imageUrl: '/images/raayonit-brands/20.png', chainsCount: 3 })
const general = offer('g', { perkScope: 'multi_chain', brandName: 'תו על' })

describe('resolveChainBrands', () => {
  it('ignores case, spacing, punctuation and diacritics when matching a name', () => {
    expect(brandNameKey('Café Café')).toBe(brandNameKey('CAFECAFE'))
    expect(brandNameKey('HOLMES  PLACE')).toBe(brandNameKey('Holmes Place'))
  })
  it('matches a voucher\'s frozen chain names to the live brand offers, with their logo, branch count and page', () => {
    const got = resolveChainBrands({ perkScope: 'multi_chain', participatingChains: ['HOLMES PLACE', 'סבון של פעם', 'Café Café', 'unknown brand'] }, [holmes, cafe, sabon, general])
    expect(got.map((b) => b.offerId)).toEqual(['h', 's', 'c'])
    expect(got[0]).toMatchObject({ name: 'HOLMES PLACE', logoUrl: '/images/raayonit-brands/4.png', branchCount: 8 })
    expect(got[2]!.photo).toBe(true)
  })
  it('prefers the live offer\'s own brand index', () => {
    const index = [{ offerId: 'x', name: 'X', logoUrl: '', branchCount: 1 }]
    expect(resolveChainBrands({ offerId: 'g', perkScope: 'multi_chain', participatingChains: ['HOLMES PLACE'] }, [{ ...general, brandIndex: index } as OfferDocument, holmes])).toEqual(index)
  })
  it('is empty for a single-brand perk, or when nothing matches', () => {
    expect(resolveChainBrands({ perkScope: 'single_business', participatingChains: ['HOLMES PLACE'] }, [holmes])).toEqual([])
    expect(resolveChainBrands({ perkScope: 'multi_chain', participatingChains: ['nope'] }, [holmes])).toEqual([])
  })
  it('lists the biggest chains first', () => {
    const sorted = sortBrandsByReach([{ name: 'b', branchCount: 3 }, { name: 'a', branchCount: 42 }, { name: 'c', branchCount: 3 }])
    expect(sorted.map((b) => b.name)).toEqual(['a', 'b', 'c'])
  })
})

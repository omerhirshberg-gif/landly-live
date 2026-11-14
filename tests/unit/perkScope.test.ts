import { describe, expect, it } from 'vitest'
import { frozenNationwide, frozenPerkScope, hasSinglePlace, normalizeChains, parsePerkScope, parsePerkScopeFields, readPerkScope } from '@/lib/offers/perkScope'

const ok = (r: ReturnType<typeof parsePerkScopeFields>) => (r.ok ? r.fields : r.error)

describe('parsePerkScopeFields', () => {
  it('direct: needs a business, forbids brand fields', () => {
    expect(ok(parsePerkScopeFields({ fulfillmentType: 'direct_merchant', businessId: 'b1' }))).toEqual({ perkScope: 'single_business', isNationwide: false, businessId: 'b1' })
    expect(ok(parsePerkScopeFields({ fulfillmentType: 'direct_merchant', businessId: 'b1', isNationwide: true }))).toEqual({ perkScope: 'single_business', isNationwide: true, businessId: 'b1' })
    expect(parsePerkScopeFields({ fulfillmentType: 'direct_merchant' }).ok).toBe(false)
    expect(parsePerkScopeFields({ fulfillmentType: 'direct_merchant', businessId: 'b1', brandName: 'Fox' }).ok).toBe(false)
    expect(parsePerkScopeFields({ fulfillmentType: 'direct_merchant', businessId: 'b1', participatingChains: ['A'] }).ok).toBe(false)
    expect(parsePerkScopeFields({ fulfillmentType: 'direct_merchant', businessId: 'b1', perkScope: 'multi_chain' }).ok).toBe(false)
  })

  it('multipass single brand: brand required, no business, optional stores', () => {
    expect(ok(parsePerkScopeFields({ fulfillmentType: 'multipass_pool', brandName: ' Fox  Home ' }))).toEqual({ perkScope: 'single_business', isNationwide: true, brandName: 'Fox Home' })
    expect(ok(parsePerkScopeFields({ fulfillmentType: 'multipass_pool', perkScope: 'single_business', brandName: 'Fox' }))).toEqual({ perkScope: 'single_business', isNationwide: true, brandName: 'Fox' })
    expect(parsePerkScopeFields({ fulfillmentType: 'multipass_pool' }).ok).toBe(false)
    expect(parsePerkScopeFields({ fulfillmentType: 'multipass_pool', brandName: 'Fox', businessId: 'b1' }).ok).toBe(false)
    expect(ok(parsePerkScopeFields({ fulfillmentType: 'multipass_pool', brandName: 'Fox', participatingChains: ['Azrieli', 'azrieli', 'Dizengoff Center'] })))
      .toEqual({ perkScope: 'single_business', isNationwide: true, brandName: 'Fox', participatingChains: ['Azrieli', 'Dizengoff Center'], chainsCount: 2 })
    expect(parsePerkScopeFields({ fulfillmentType: 'multipass_pool', brandName: 'Fox', participatingChains: ['x'.repeat(61)] }).ok).toBe(false)
    expect(parsePerkScopeFields({ fulfillmentType: 'multipass_pool', brandName: 'Fox', universalRedemptionGuide: { en: 'hi' } }).ok).toBe(false)
  })

  it('direct: participating stores need the nationwide switch', () => {
    expect(parsePerkScopeFields({ fulfillmentType: 'direct_merchant', businessId: 'b1', participatingChains: ['Azrieli'] }).ok).toBe(false)
    expect(ok(parsePerkScopeFields({ fulfillmentType: 'direct_merchant', businessId: 'b1', isNationwide: true, participatingChains: ['Azrieli'] })))
      .toEqual({ perkScope: 'single_business', isNationwide: true, businessId: 'b1', participatingChains: ['Azrieli'], chainsCount: 1 })
  })

  it('freezes the stores onto a nationwide local order and a Multipass one', () => {
    expect(frozenNationwide({ isNationwide: true, participatingChains: ['A', 'B'] })).toEqual({ isNationwide: true, participatingChains: ['A', 'B'], chainsCount: 2 })
    expect(frozenNationwide({ isNationwide: true })).toEqual({ isNationwide: true })
    expect(frozenNationwide({ participatingChains: ['A'] })).toEqual({})
    expect(frozenPerkScope({ perkScope: 'single_business', brandName: 'Fox', participatingChains: ['A'] })).toMatchObject({ participatingChains: ['A'], chainsCount: 1 })
  })

  it('multipass multi-chain: brand and 1..N chains, deduplicated', () => {
    const r = parsePerkScopeFields({ fulfillmentType: 'multipass_pool', perkScope: 'multi_chain', brandName: 'BUYME All Style', participatingChains: ['Fox', 'fox', ' Castro ', ''], universalRedemptionGuide: { he: 'מציגים', en: '' } })
    expect(ok(r)).toEqual({ perkScope: 'multi_chain', isNationwide: true, brandName: 'BUYME All Style', participatingChains: ['Fox', 'Castro'], chainsCount: 2, universalRedemptionGuide: { he: 'מציגים', en: '' } })
    expect(parsePerkScopeFields({ fulfillmentType: 'multipass_pool', perkScope: 'multi_chain', brandName: 'X', participatingChains: [] }).ok).toBe(false)
    expect(parsePerkScopeFields({ fulfillmentType: 'multipass_pool', perkScope: 'multi_chain', participatingChains: ['A'] }).ok).toBe(false)
    expect(parsePerkScopeFields({ fulfillmentType: 'multipass_pool', perkScope: 'multi_chain', brandName: 'X', businessId: 'b', participatingChains: ['A'] }).ok).toBe(false)
    expect(parsePerkScopeFields({ fulfillmentType: 'multipass_pool', perkScope: 'multi_chain', brandName: 'X', participatingChains: Array.from({ length: 41 }, (_, i) => `c${i}`) }).ok).toBe(false)
  })

  it('rejects an unknown scope', () => {
    expect(parsePerkScopeFields({ fulfillmentType: 'multipass_pool', perkScope: 'nope', brandName: 'X' }).ok).toBe(false)
  })
})

describe('helpers', () => {
  it('normalizeChains splits a semicolon list', () => {
    expect(normalizeChains('Fox; Castro;fox;;')).toEqual(['Fox', 'Castro'])
    expect(normalizeChains(undefined)).toEqual([])
  })
  it('legacy offers read as single-business', () => {
    expect(parsePerkScope(undefined)).toBe('single_business')
    expect(readPerkScope({})).toMatchObject({ perkScope: 'single_business', chainsCount: 0, universalRedemptionGuide: null })
    expect(readPerkScope({ perkScope: 'multi_chain', participatingChains: ['A', 'B'] }).chainsCount).toBe(2)
  })
  it('multi-chain perks have no single place', () => {
    expect(hasSinglePlace({ perkScope: 'multi_chain' })).toBe(false)
    expect(hasSinglePlace({})).toBe(true)
    expect(hasSinglePlace({ fulfillmentType: 'multipass_pool' })).toBe(false)
    expect(hasSinglePlace({ isNationwide: true })).toBe(false)
  })
})

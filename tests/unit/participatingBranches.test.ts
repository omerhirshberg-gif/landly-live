import { describe, expect, it } from 'vitest'
import { participatingBranches } from '@/lib/offers/participatingBranches'
import { parseParticipatingPlaces, placeChainName } from '@/lib/geo'
import { frozenNationwide, frozenPerkScope, parsePerkScopeFields, readPerkScope } from '@/lib/offers/perkScope'

const big = { placeId: 'p-big', names: { he: 'ביג גלילות', en: 'BIG Fashion Glilot', ru: 'BIG Glilot' }, address: { en: 'Glilot' }, lat: 32.14, lng: 34.8 }
const mall = { placeId: 'p-mall', names: { he: 'קניון גבעתיים' }, lat: 32.07, lng: 34.81 }

describe('participatingBranches', () => {
  it('names a picked branch in the reader\'s language, falling back to English then Hebrew', () => {
    const subject = { participatingChains: ['ביג גלילות', 'קניון גבעתיים'], participatingPlaces: [big, mall] }
    expect(participatingBranches(subject, 'ru').map((b) => b.label)).toEqual(['BIG Glilot', 'קניון גבעתיים'])
    expect(participatingBranches(subject, 'fr').map((b) => b.label)).toEqual(['BIG Fashion Glilot', 'קניון גבעתיים'])
    expect(participatingBranches(subject, 'en')[0]).toMatchObject({ name: 'ביג גלילות', point: { lat: 32.14, lng: 34.8, placeId: 'p-big' } })
  })

  it('keeps typed names as written, after the picked branches, and never repeats a picked one', () => {
    const subject = { participatingChains: ['FOX', 'ביג גלילות', 'Castro'], participatingPlaces: [big] }
    const list = participatingBranches(subject, 'en')
    expect(list.map((b) => b.label)).toEqual(['BIG Fashion Glilot', 'FOX', 'Castro'])
    expect(list[1]!.point).toBeUndefined()
    expect(participatingBranches({ participatingChains: ['FOX'] }, 'he').map((b) => b.label)).toEqual(['FOX'])
    expect(participatingBranches(null, 'en')).toEqual([])
  })
})

describe('participating places in the perk scope', () => {
  const local = { fulfillmentType: 'direct_merchant' as const, businessId: 'b1', isNationwide: true }
  it('derives the chain names from the picked branches and keeps typed ones that are not among them', () => {
    const r = parsePerkScopeFields({ ...local, participatingPlaces: [big, mall], participatingChains: ['FOX', 'ביג גלילות'] })
    expect(r.ok && r.fields).toMatchObject({ participatingChains: ['ביג גלילות', 'קניון גבעתיים', 'FOX'], chainsCount: 3 })
    expect(r.ok && r.fields.participatingPlaces?.map((p) => p.placeId)).toEqual(['p-big', 'p-mall'])
  })
  it('needs the nationwide switch, ignores places on a multi-chain pass, and drops unusable ones', () => {
    expect(parsePerkScopeFields({ fulfillmentType: 'direct_merchant', businessId: 'b1', participatingPlaces: [big] }).ok).toBe(false)
    const multi = parsePerkScopeFields({ fulfillmentType: 'multipass_pool', perkScope: 'multi_chain', brandName: 'BUYME', participatingChains: ['FOX'], participatingPlaces: [big] })
    expect(multi.ok && multi.fields.participatingPlaces).toBeUndefined()
    expect(parseParticipatingPlaces([{ placeId: 'x', names: {}, lat: 1, lng: 1 }, { placeId: 'y', names: { he: 'א' }, lat: 99, lng: 1 }, big, big])).toHaveLength(1)
    expect(placeChainName({ names: { en: 'Only English' } })).toBe('Only English')
  })
  it('is read back and frozen onto orders and vouchers', () => {
    const stored = { isNationwide: true, participatingChains: ['ביג גלילות'], participatingPlaces: [big] }
    expect(readPerkScope(stored).participatingPlaces).toHaveLength(1)
    expect(frozenNationwide(stored)).toMatchObject({ participatingPlaces: [big] })
    expect(frozenPerkScope({ ...stored, perkScope: 'single_business', brandName: 'BIG' })).toMatchObject({ participatingPlaces: [big] })
    expect(frozenNationwide({ participatingChains: ['A'] })).toEqual({})
  })
})

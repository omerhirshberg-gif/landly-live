import { describe, expect, it } from 'vitest'
import { locationNotice, locationNoticeKind, shouldShowLocationNavigation, withCount } from '@/lib/offers/locationVisibility'
import { voucherDestination } from '@/lib/member/voucherDestination'
import { offerDistanceKm } from '@/lib/perks/perksFilter'
import { frozenPerkScope } from '@/lib/offers/perkScope'
import { translations } from '@/lib/i18n/translations'

const geo = { lat: 32.08, lng: 34.78 }
const address = { short: { en: 'Dizengoff 1', he: 'דיזנגוף 1' }, formatted: { en: 'Dizengoff 1, Tel Aviv' }, placeId: 'p1' }

describe('shouldShowLocationNavigation', () => {
  it('shows a single-location direct offer with coordinates or an address', () => {
    expect(shouldShowLocationNavigation({ fulfillmentType: 'direct_merchant', geo })).toBe(true)
    expect(shouldShowLocationNavigation({ geo: null, location: 'Dizengoff 1' })).toBe(true)
    expect(shouldShowLocationNavigation({ address })).toBe(true)
    // A voucher carries the place under businessGeo / businessAddress; older ones have no fulfillmentType.
    expect(shouldShowLocationNavigation({ businessGeo: geo })).toBe(true)
    expect(shouldShowLocationNavigation({ businessAddress: address })).toBe(true)
  })
  it('hides Multipass, multi-chain and nationwide perks even with a place', () => {
    expect(shouldShowLocationNavigation({ fulfillmentType: 'multipass_pool', geo, address })).toBe(false)
    expect(shouldShowLocationNavigation({ perkScope: 'multi_chain', geo })).toBe(false)
    expect(shouldShowLocationNavigation({ fulfillmentType: 'direct_merchant', isNationwide: true, geo, address })).toBe(false)
  })
  it('hides a perk with no usable place', () => {
    expect(shouldShowLocationNavigation({ fulfillmentType: 'direct_merchant' })).toBe(false)
    expect(shouldShowLocationNavigation({ geo: { lat: NaN, lng: 1 }, address: '  ' })).toBe(false)
    expect(shouldShowLocationNavigation({ geo: null, address: null, location: '' })).toBe(false)
  })
  it('reads a missing or non-true isNationwide as false', () => {
    expect(shouldShowLocationNavigation({ geo, isNationwide: undefined })).toBe(true)
    expect(shouldShowLocationNavigation({ geo, isNationwide: 'true' })).toBe(true)
  })
})

describe('locationNoticeKind', () => {
  it('picks the replacement notice', () => {
    expect(locationNoticeKind({ perkScope: 'multi_chain', fulfillmentType: 'multipass_pool' })).toBe('chains')
    expect(locationNoticeKind({ fulfillmentType: 'multipass_pool' })).toBe('participating')
    expect(locationNoticeKind({ fulfillmentType: 'direct_merchant', isNationwide: true })).toBe('nationwide')
    expect(locationNoticeKind({ fulfillmentType: 'direct_merchant', geo })).toBeNull()
  })
})

describe('locationNotice', () => {
  it('names the stores when some are listed, with a singular for one', () => {
    expect(locationNotice({ fulfillmentType: 'direct_merchant', isNationwide: true })).toEqual({ key: 'perk_valid_all_stores', count: 0 })
    expect(locationNotice({ fulfillmentType: 'multipass_pool' })).toEqual({ key: 'perk_valid_participating_stores', count: 0 })
    expect(locationNotice({ fulfillmentType: 'multipass_pool', participatingChains: ['A'] })).toEqual({ key: 'perk_valid_one_store', count: 1 })
    expect(locationNotice({ isNationwide: true, participatingChains: ['A', ' ', 'B', 'C'] })).toEqual({ key: 'perk_valid_n_stores', count: 3 })
    expect(locationNotice({ perkScope: 'multi_chain', participatingChains: ['A', 'B'] })).toEqual({ key: 'perk_honoured_at_chains', count: 2 })
    expect(locationNotice({ fulfillmentType: 'direct_merchant', geo })).toBeNull()
  })
  it('has every notice line in all five languages, with {n} only where a count is shown', () => {
    for (const lang of ['en', 'he', 'ru', 'fr', 'es'] as const) {
      const t = translations[lang] as Record<string, string>
      for (const key of ['perk_valid_all_stores', 'perk_valid_participating_stores', 'perk_valid_one_store', 'perk_valid_n_stores', 'perk_stores_title']) expect(t[key], `${lang}.${key}`).toBeTruthy()
      expect(t.perk_valid_n_stores).toContain('{n}')
      expect(t.perk_valid_all_stores).not.toContain('{n}')
      expect(t.perk_valid_all_stores).not.toMatch(/branch|סניפי הרשת/i)
    }
    expect(withCount('Valid at {n} stores', 3)).toBe('Valid at \u20663\u2069 stores')
  })
})

describe('surfaces that follow the rule', () => {
  it('a voucher drops its address and destination', () => {
    expect(voucherDestination({ businessAddress: address as never, businessGeo: geo }, 'en').destination).not.toBeNull()
    expect(voucherDestination({ businessAddress: address as never, businessGeo: geo, isNationwide: true }, 'en')).toEqual({ place: '', destination: null })
    expect(voucherDestination({ businessAddress: address as never, businessGeo: geo, fulfillmentType: 'multipass_pool' }, 'en')).toEqual({ place: '', destination: null })
  })
  it('Near Me never gives a multi-branch perk a distance', () => {
    const origin = { lat: 32.0, lng: 34.8 }
    expect(offerDistanceKm({ geo, perkScope: 'single_business', fulfillmentType: 'direct_merchant' }, origin)).toBeGreaterThan(0)
    expect(offerDistanceKm({ geo, isNationwide: true }, origin)).toBeNull()
    expect(offerDistanceKm({ geo, fulfillmentType: 'multipass_pool' }, origin)).toBeNull()
  })
  it('freezes isNationwide onto a Multipass snapshot only when set', () => {
    expect(frozenPerkScope({ perkScope: 'single_business', brandName: 'Fox', isNationwide: true })).toMatchObject({ isNationwide: true })
    expect(frozenPerkScope({ perkScope: 'single_business', brandName: 'Fox' })).not.toHaveProperty('isNationwide')
  })
})

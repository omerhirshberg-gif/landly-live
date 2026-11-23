import { describe, expect, it } from 'vitest'
import { flagshipPurchase } from '@/lib/offers/flagshipPurchase'
import { checkoutPath, offerRouteKind, webOfferHref } from '@/lib/offers/offerRoutes'

// The 3-tier ladder: 100 for 89 (-11%), 150 for 132 (-12%), 200 for 174 (-13%, the pre-selected "Best value").
const variants = [
  { poolId: 'p100', faceValueAgorot: 10000, priceAgorot: 8900 },
  { poolId: 'p150', faceValueAgorot: 15000, priceAgorot: 13200 },
  { poolId: 'p200', faceValueAgorot: 20000, priceAgorot: 17400 },
]
const base = { variants, picked: '', claimedPools: [] as string[], now: Date.UTC(2026, 0, 1) }

describe('offerRouteKind', () => {
  it('tells the flagship, a chain and a direct perk apart', () => {
    expect(offerRouteKind({ fulfillmentType: 'raayonit_pool', perkScope: 'multi_chain' })).toBe('flagship')
    expect(offerRouteKind({ fulfillmentType: 'raayonit_pool', perkScope: 'single_chain' } as never)).toBe('chain')
    expect(offerRouteKind({ fulfillmentType: 'pool', perkScope: 'single_store' } as never)).toBe('direct')
  })
  it('sends the flagship to the hub and others to their page', () => {
    expect(webOfferHref({ id: 'f', fulfillmentType: 'raayonit_pool', perkScope: 'multi_chain' })).toBe('/raayonit')
    expect(webOfferHref({ id: 'c1', fulfillmentType: 'raayonit_pool', perkScope: 'single_chain' } as never)).toBe('/offers/c1')
  })
})

describe('checkoutPath', () => {
  it('carries the offer and the variant pool the checkout reads', () => {
    expect(checkoutPath('abc', 'p150')).toBe('/checkout?offerId=abc&variant=p150')
    expect(checkoutPath('a b')).toBe('/checkout?offerId=a%20b')
  })
})

describe('flagshipPurchase', () => {
  it('selects the picked value, else the highest (the 200 / 174 "Best value")', () => {
    expect(flagshipPurchase({ ...base, picked: 'p150' }).selected?.poolId).toBe('p150')
    expect(flagshipPurchase({ ...base, picked: 'p100' }).selected?.poolId).toBe('p100')
    expect(flagshipPurchase(base).selected?.poolId).toBe('p200')
  })
  it('skips an owned value and blocks when every one is owned', () => {
    expect(flagshipPurchase({ ...base, picked: 'p100', claimedPools: ['p100'] }).selected?.poolId).toBe('p200')
    expect(flagshipPurchase({ ...base, claimedPools: ['p200'] }).selected?.poolId).toBe('p150')
    expect(flagshipPurchase({ ...base, claimedPools: ['p100', 'p150', 'p200'] }).block).toBe('owned')
  })
  it('blocks when expired or sold out, not otherwise', () => {
    expect(flagshipPurchase({ ...base, expiryDate: new Date(Date.UTC(2025, 0, 1)) }).block).toBe('expired')
    expect(flagshipPurchase({ ...base, totalQuantity: 5, claimedCount: 5 }).block).toBe('soldOut')
    expect(flagshipPurchase({ ...base, totalQuantity: 5, claimedCount: 4 }).block).toBeNull()
    expect(flagshipPurchase(base).block).toBeNull()
  })
})

describe('flagshipPurchase in launch-pending mode', () => {
  it('blocks the purchase as comingSoon and wins over every other state', () => {
    expect(flagshipPurchase({ ...base, comingSoon: true }).block).toBe('comingSoon')
    expect(flagshipPurchase({ ...base, comingSoon: true, claimedPools: ['p100', 'p150', 'p200'] }).block).toBe('comingSoon')
    expect(flagshipPurchase({ ...base, comingSoon: true, expiryDate: new Date(0) }).block).toBe('comingSoon')
  })
  it('still selects a value, so the ladder and the card keep showing it', () => {
    expect(flagshipPurchase({ ...base, comingSoon: true }).selected?.poolId).toBe('p200')
  })
  it('changes nothing when it is off', () => {
    expect(flagshipPurchase({ ...base, comingSoon: false }).block).toBeNull()
    expect(flagshipPurchase(base).block).toBeNull()
  })
})

import { describe, expect, it, vi } from 'vitest'
import { buildCategoryRails } from '@/lib/home/categoryRails'
import { landlyOffers } from '@/lib/offers/discoverTab'
import { offerRouteKind, raayonitHubPath, webOfferHref, webOfferPath } from '@/lib/offers/offerRoutes'
import type { OfferDocument } from '@/lib/firebase/offers'

vi.mock('@/lib/firebase/config', () => ({ db: {}, auth: {} }))

const make = (id: string, fulfillmentType: string, perkScope: string, category = 'Fashion and Shopping') =>
  ({ id, fulfillmentType, perkScope, category, offerPrice: 10, originalPrice: 20, isActive: true, expiryDate: null }) as unknown as OfferDocument

const flagship = make('f', 'raayonit_pool', 'multi_chain')
const chain = make('c', 'raayonit_pool', 'single_business')
const direct = make('d', 'direct_merchant', 'single_business')

describe('offer routes', () => {
  it('classifies the three kinds', () => {
    expect(offerRouteKind(flagship)).toBe('flagship')
    expect(offerRouteKind(chain)).toBe('chain')
    expect(offerRouteKind(direct)).toBe('direct')
  })
  it('sends the flagship to the hub and the rest to their own page', () => {
    expect(webOfferHref(flagship)).toBe('/raayonit')
    expect(webOfferHref(chain)).toBe('/offers/c')
    expect(webOfferHref(direct)).toBe('/offers/d')
    expect(webOfferPath('a b', 150)).toBe('/offers/a%20b?denomination=150')
    expect(raayonitHubPath('hotels')).toBe('/raayonit?category=hotels')
    expect(raayonitHubPath('all')).toBe('/raayonit')
  })
})

describe('category decoupling', () => {
  it('never lets Raayonit offers into GoLandly lists or category rails', () => {
    const all = [flagship, chain, direct]
    expect(landlyOffers(all).map((o) => o.id)).toEqual(['d'])
    const rails = buildCategoryRails(all)
    expect(rails.reduce((n, r) => n + r.total, 0)).toBeLessThanOrEqual(1)
  })
})

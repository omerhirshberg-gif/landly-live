import { describe, expect, it, vi } from 'vitest'
import type { OfferDocument } from '@/lib/firebase/offers'
import { CATEGORY_TILES } from '@/lib/categories'
import { buildHomeCategorySlots, HOME_SLOT_COUNT } from '@/lib/home/categoryRails'
import { landlyOffers } from '@/lib/offers/discoverTab'

vi.mock('@/lib/firebase/config', () => ({ db: {}, auth: {}, app: {} }))

function offer(overrides: Partial<OfferDocument> & { id: string }): OfferDocument {
  return {
    businessId: 'b1', businessName: 'Biz', location: '', imageUrl: '', title: overrides.id, description: '',
    originalPrice: 100, offerPrice: 80, category: 'Restaurants and Cafes', createdAt: null, isBestseller: false,
    expiryDate: null, totalQuantity: null, claimedCount: 0, validityDays: 180, redemptionTerms: '',
    redemptionMethod: 'in_store', redemptionInstructions: '', ...overrides,
  }
}

describe('buildHomeCategorySlots', () => {
  it('returns every official category in tile order, each with exactly ten slots, all placeholders when empty', () => {
    const groups = buildHomeCategorySlots([])
    expect(groups.map((g) => g.tile.category)).toEqual(CATEGORY_TILES.map((t) => t.category))
    for (const g of groups) {
      expect(g.slots).toHaveLength(HOME_SLOT_COUNT)
      expect(g.slots.every((s) => s.kind === 'placeholder')).toBe(true)
    }
  })

  it('puts a category’s real perks first and pads with placeholders, so a new perk replaces one', () => {
    const [food] = buildHomeCategorySlots([offer({ id: 'a' }), offer({ id: 'b' })])
    expect(food.slots.map((s) => s.kind)).toEqual(['offer', 'offer', ...Array(8).fill('placeholder')])
    const beach = buildHomeCategorySlots([offer({ id: 'c', category: 'Beach and Sea' })]).find((g) => g.tile.category === 'Beach and Sea')!
    expect(beach.slots[0]).toMatchObject({ kind: 'offer', key: 'c' })
  })

  it('caps at ten real perks and has unique keys', () => {
    const many = Array.from({ length: 14 }, (_, i) => offer({ id: `o${i}` }))
    const [food] = buildHomeCategorySlots(many)
    expect(food.slots).toHaveLength(HOME_SLOT_COUNT)
    expect(new Set(food.slots.map((s) => s.key)).size).toBe(HOME_SLOT_COUNT)
  })

  it('never lists Raayonit offers (the Home list is landlyOffers, and the builder drops them too)', () => {
    const chain = offer({ id: 'r', fulfillmentType: 'raayonit_pool' })
    expect(landlyOffers([chain])).toHaveLength(0)
    expect(buildHomeCategorySlots([chain])[0].slots.every((s) => s.kind === 'placeholder')).toBe(true)
  })
})

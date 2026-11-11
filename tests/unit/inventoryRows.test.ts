import { describe, expect, it } from 'vitest'
import { DEFAULT_LOW_STOCK, buildInventoryRows, filterInventory, sortByUrgency, stockHealth, type InventoryOffer, type InventoryPool } from '@/lib/admin/inventoryRows'

const offer = (over: Partial<InventoryOffer> = {}): InventoryOffer => ({ id: 'o1', title: 'Perk', businessName: 'Biz', fulfillmentType: 'direct_merchant', poolId: null, totalQuantity: null, claimedCount: 0, ...over })
const pool = (over: Partial<InventoryPool> = {}): InventoryPool => ({ poolId: 'o1', offerId: 'o1', status: 'active', totalPurchased: 100, allocatedCount: 40, remainingCount: 60, warningThreshold: 10, ...over })

describe('stock health', () => {
  it('is out at zero, low at or under the threshold, otherwise ok; null means unlimited', () => {
    expect(stockHealth(0, 10)).toBe('out')
    expect(stockHealth(10, 10)).toBe('low')
    expect(stockHealth(11, 10)).toBe('ok')
    expect(stockHealth(null, 10)).toBe('unlimited')
  })
})

describe('inventory rows', () => {
  it('shows a Multipass perk from its supply, with the supply’s own threshold', () => {
    const [row] = buildInventoryRows([offer({ fulfillmentType: 'multipass_pool', poolId: 'o1' })], [pool({ remainingCount: 4, warningThreshold: 5 })])
    expect(row).toMatchObject({ kind: 'multipass', poolId: 'o1', purchased: 100, claimed: 40, remaining: 4, threshold: 5, health: 'low' })
  })

  it('falls back to the default threshold of 10 and treats a missing supply as out', () => {
    const [a] = buildInventoryRows([offer({ fulfillmentType: 'multipass_pool' })], [pool({ warningThreshold: Number.NaN, remainingCount: 10 })])
    expect(a!.threshold).toBe(DEFAULT_LOW_STOCK)
    expect(a!.health).toBe('low')
    const [b] = buildInventoryRows([offer({ fulfillmentType: 'multipass_pool' })], [])
    expect(b).toMatchObject({ remaining: 0, health: 'out', purchased: 0 })
  })

  it('counts a local perk against its cap, with no restock target', () => {
    const rows = buildInventoryRows([offer({ id: 'a', totalQuantity: 50, claimedCount: 47 }), offer({ id: 'b' }), offer({ id: 'c', totalQuantity: 5, claimedCount: 5 })], [])
    expect(rows.map((r) => [r.kind, r.poolId, r.remaining, r.health])).toEqual([['direct', null, 3, 'low'], ['direct', null, null, 'unlimited'], ['direct', null, 0, 'out']])
  })

  it('lists the most urgent first and filters by text and health', () => {
    const rows = buildInventoryRows(
      [offer({ id: 'a', title: 'B ok', totalQuantity: 100, claimedCount: 1 }), offer({ id: 'b', title: 'A out', totalQuantity: 2, claimedCount: 2 }), offer({ id: 'c', title: 'C low', businessName: 'Cafe', totalQuantity: 20, claimedCount: 19 })],
      [],
    )
    expect(sortByUrgency(rows).map((r) => r.title)).toEqual(['A out', 'C low', 'B ok'])
    expect(filterInventory(rows, { query: '', health: 'low' }).map((r) => r.title)).toEqual(['C low'])
    expect(filterInventory(rows, { query: 'cafe', health: 'all' }).map((r) => r.title)).toEqual(['C low'])
  })
})

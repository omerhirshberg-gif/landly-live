import { beforeAll, describe, expect, it, vi } from 'vitest'
import { randomBytes } from 'node:crypto'
import { addPoolCodes, createSharedPool } from '@/lib/inventory/poolAdmin'
import { claimOfferForOrder } from '@/lib/payments/claimOfferForOrder'
import { initiateOrder } from '@/lib/payments/initiateOrder'
import { findVariant, orderIdFor, orderIdMatches, parseVariants, startingVariant, variantDiscountPercent } from '@/lib/offers/variants'
import { planRaayonitMigration } from '@/lib/inventory/raayonitMigration'
import { toOfferDocument } from '@/lib/offers/offerDocument'
import { TransactionStore } from '../helpers/transactionStore'
import { offer, terminal } from '../helpers/paymentFixtures'

vi.mock('@/lib/firebase/config', () => ({ db: {}, auth: {} }))
const { buildCategoryRails } = await import('@/lib/home/categoryRails')

beforeAll(() => { process.env.POOL_CODES_KEY = randomBytes(32).toString('base64') })

describe('variant helpers', () => {
  const raw = [
    { faceValueAgorot: 15000, priceAgorot: 12900, poolId: 'p150' },
    { faceValueAgorot: 10000, priceAgorot: 8900, poolId: 'p100' },
    { faceValueAgorot: 10000, priceAgorot: 8900, poolId: 'p100' }, // duplicate pool
    { faceValueAgorot: -1, priceAgorot: 1, poolId: 'bad' },
    { faceValueAgorot: 5000, priceAgorot: 4000 },
  ]
  it('keeps valid, de-duplicated variants, cheapest value first', () => {
    expect(parseVariants(raw).map((v) => v.poolId)).toEqual(['p100', 'p150'])
    expect(parseVariants('nope')).toEqual([])
  })
  it('finds a variant by pool and prices the discount', () => {
    const v = parseVariants(raw)
    expect(findVariant(v, 'p150')?.priceAgorot).toBe(12900)
    expect(findVariant(v, 'other')).toBeNull()
    expect(variantDiscountPercent(v[0]!)).toBe(11)
    expect(variantDiscountPercent(v[1]!)).toBe(14)
    expect(startingVariant(v)?.poolId).toBe('p100')
    expect(startingVariant([v[0]!])).toBeNull()
  })
  it('keys an order by variant and still recognises the legacy id', () => {
    expect(orderIdFor('u', 'o')).toBe('u_o')
    expect(orderIdFor('u', 'o', 'p150')).toBe('u_o_p150')
    expect(orderIdMatches('u_o', { userId: 'u', offerId: 'o' })).toBe(true)
    expect(orderIdMatches('u_o_p150', { userId: 'u', offerId: 'o', poolId: 'p150', variant: true })).toBe(true)
    expect(orderIdMatches('u_o_p150', { userId: 'u', offerId: 'o', poolId: 'p100', variant: true })).toBe(false)
    expect(orderIdMatches('u_o_p150', { userId: 'u', offerId: 'o', poolId: 'p150' })).toBe(false)
  })
  it('reads variants onto an offer document, and none for a plain offer', () => {
    expect(toOfferDocument('x', { variants: raw }).variants).toHaveLength(2)
    expect(toOfferDocument('x', {})).not.toHaveProperty('variants')
  })
})

// One brand offer selling two stocks: 100 for 89 and 150 for 129.
const { businessId: _omit, ...base } = offer
void _omit
async function brandStore() {
  const db = new TransactionStore()
  const p100 = await createSharedPool(db.db as never, { title: 'Raayonit 100', faceValueAgorot: 10000, priceAgorot: 8900, warningThreshold: 1, unitCostAgorot: 0 })
  const p150 = await createSharedPool(db.db as never, { title: 'Raayonit 150', faceValueAgorot: 15000, priceAgorot: 12900, warningThreshold: 1, unitCostAgorot: 0 })
  await addPoolCodes(db.db as never, p100, ['C100-A', 'C100-B'])
  await addPoolCodes(db.db as never, p150, ['C150-A'])
  db.seed('offers/offer', {
    ...base, fulfillmentType: 'raayonit_pool', perkScope: 'single_business', brandName: 'FOX', businessName: 'FOX', title: 'FOX',
    totalQuantity: null, offerPrice: 89, originalPrice: 100, poolId: p100,
    variants: [{ faceValueAgorot: 10000, priceAgorot: 8900, poolId: p100 }, { faceValueAgorot: 15000, priceAgorot: 12900, poolId: p150 }],
  })
  return { db, p100, p150 }
}

describe('multi-denomination checkout', () => {
  it('prices the order from the chosen variant, never from the client, and draws from its stock', async () => {
    const { db, p150 } = await brandStore()
    const res = await initiateOrder(db.db, 'user', 'offer', terminal, { variantPoolId: p150 })
    expect(res.orderId).toBe(`user_offer_${p150}`)
    expect(res.amount).toBe(129)
    expect(res.originalPrice).toBe(150)
    expect(db.read(`orders/user_offer_${p150}`)).toMatchObject({ amountAgorot: 12900, poolId: p150, variant: true })
    await claimOfferForOrder(db.db, { orderId: `user_offer_${p150}`, terminal, tranzilaTxnId: 't150', approved: true, responseCode: '000', amountAgorot: 12900, currency: 'ILS' })
    expect(db.read(`vouchers/user_offer_${p150}`)).toMatchObject({ externalCode: 'C150-A', faceValueAgorot: 15000, poolId: p150 })
  })
  it('lets a member buy both values of the same brand', async () => {
    const { db, p100, p150 } = await brandStore()
    await initiateOrder(db.db, 'user', 'offer', terminal, { variantPoolId: p100 })
    await claimOfferForOrder(db.db, { orderId: `user_offer_${p100}`, terminal, tranzilaTxnId: 'a', approved: true, responseCode: '000', amountAgorot: 8900, currency: 'ILS' })
    await expect(initiateOrder(db.db, 'user', 'offer', terminal, { variantPoolId: p150 })).resolves.toMatchObject({ amount: 129 })
    // but not the same value twice
    await expect(initiateOrder(db.db, 'user', 'offer', terminal, { variantPoolId: p100 })).rejects.toThrow(/already claimed/)
  })
  it('refuses an unknown value and requires a choice when there are several', async () => {
    const { db } = await brandStore()
    await expect(initiateOrder(db.db, 'user', 'offer', terminal, { variantPoolId: 'forged' })).rejects.toThrow(/Unknown voucher value/)
    await expect(initiateOrder(db.db, 'user', 'offer', terminal)).rejects.toThrow(/Choose a voucher value/)
  })
  it('treats a legacy voucher on the default stock as already owning that value', async () => {
    const { db, p100 } = await brandStore()
    db.seed('vouchers/user_offer', { userId: 'user', offerId: 'offer', status: 'active' })
    await expect(initiateOrder(db.db, 'user', 'offer', terminal, { variantPoolId: p100 })).rejects.toThrow(/already claimed/)
  })
})

describe('Raayonit card migration', () => {
  it('keeps the cheapest stock\'s card per brand, re-keys it and retires its twins', () => {
    const plan = planRaayonitMigration([
      { id: 'a150', sourceKey: 'raayonit:pool150:fox', faceValueAgorot: 15000 },
      { id: 'a100', sourceKey: 'raayonit:pool100:fox', faceValueAgorot: 10000 },
      { id: 'b100', sourceKey: 'raayonit:pool100:general', faceValueAgorot: 10000 },
      { id: 'c', sourceKey: 'raayonit:castro', faceValueAgorot: 10000 }, // already migrated
      { id: 'd', sourceKey: 'something-else', faceValueAgorot: 10000 },
    ])
    expect(plan.survivors.get('fox')).toBe('a100')
    expect(plan.retire).toEqual([{ id: 'a150', supersededBy: 'a100' }])
    expect(plan.rekey).toEqual([{ id: 'a100', sourceKey: 'raayonit:fox' }, { id: 'b100', sourceKey: 'raayonit:general' }])
    expect(plan.survivors.get('castro')).toBe('c')
  })
  it('prefers a card already on the new key and is a no-op once migrated', () => {
    const plan = planRaayonitMigration([
      { id: 'new', sourceKey: 'raayonit:fox', faceValueAgorot: 10000 },
      { id: 'old', sourceKey: 'raayonit:pool100:fox', faceValueAgorot: 10000 },
    ])
    expect(plan.survivors.get('fox')).toBe('new')
    expect(plan.retire).toEqual([{ id: 'old', supersededBy: 'new' }])
    expect(planRaayonitMigration([{ id: 'new', sourceKey: 'raayonit:fox', faceValueAgorot: 10000 }])).toMatchObject({ retire: [], rekey: [] })
  })
})

describe('category rails never repeat a brand', () => {
  it('lists one card per brand under its category, with the full count for "See all"', () => {
    const mk = (id: string, category: string) => toOfferDocument(id, { title: id, category, offerPrice: 89, originalPrice: 100, totalQuantity: null, variants: [{ faceValueAgorot: 10000, priceAgorot: 8900, poolId: 'p1' }, { faceValueAgorot: 15000, priceAgorot: 12900, poolId: 'p2' }] })
    const rails = buildCategoryRails([mk('fox', 'Fashion and Shopping'), mk('castro', 'Fashion and Shopping'), mk('cafe', 'Restaurants and Cafes')])
    expect(rails.map((r) => [r.category, r.total])).toEqual([['Restaurants and Cafes', 1], ['Fashion and Shopping', 2]])
    const ids = rails.flatMap((r) => r.offers.map((o) => o.id))
    expect(new Set(ids).size).toBe(ids.length)
  })
})

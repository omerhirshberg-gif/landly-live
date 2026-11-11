import { beforeAll, describe, expect, it, vi } from 'vitest'
import { randomBytes } from 'node:crypto'
import { Timestamp } from 'firebase-admin/firestore'
import { commitSmartImport, loadMultipassPerks, matchPerks } from '@/lib/inventory/smartImport'
import { parseSmartSheet } from '@/lib/inventory/smartSheet'
import { createPool, addPoolCodes } from '@/lib/inventory/poolAdmin'
import { TransactionStore } from '../helpers/transactionStore'

vi.mock('@/lib/translate/translateOfferOnSave', () => ({
  offerTextSource: () => ({}),
  translationsForSave: async () => ({ ok: true, translations: null, warning: null }),
}))

beforeAll(() => {
  process.env.POOL_CODES_KEY = randomBytes(32).toString('base64')
})

const HEADER = ['Brand', 'Perk Name', 'Category', 'Retail Price', 'Member Price', 'Unit Cost', 'Code', 'Expiry']
const sheet = (rows: unknown[][]) => parseSmartSheet([HEADER, ...rows])
const FASHION = 'Fashion and Shopping'

async function storeWithExisting() {
  const db = new TransactionStore()
  db.seed('offers/old', { fulfillmentType: 'multipass_pool', title: 'Gift card 100', brandName: 'Fox', businessName: 'Fox', poolId: 'old', createdAt: Timestamp.now() })
  await createPool(db.db, { offerId: 'old', warningThreshold: 10, unitCostAgorot: 100, retailPriceAgorot: 10000 })
  await addPoolCodes(db.db, 'old', ['OLD1', 'OLD2'])
  return db
}

describe('smart import: matching', () => {
  it('matches by brand and title: restock, new, or ambiguous', async () => {
    const db = await storeWithExisting()
    db.seed('offers/twin', { fulfillmentType: 'multipass_pool', title: 'Gift Card 100', brandName: 'FOX' })
    db.seed('offers/solo', { fulfillmentType: 'multipass_pool', title: 'Solo', brandName: 'Castro' })
    db.seed('offers/direct', { fulfillmentType: 'direct_merchant', title: 'Solo', brandName: 'Castro' })
    const existing = await loadMultipassPerks(db.db as never)
    expect(existing.map((e) => e.offerId).sort()).toEqual(['old', 'solo', 'twin'])
    expect(existing.find((e) => e.offerId === 'old')!.remaining).toBe(2)
    const s = sheet([['Fox', 'Gift card 100', '', '', '', '', 'N1', ''], ['Castro', 'Solo', '', '', '', '', 'N2', ''], ['Zara', 'Brand new', '', '', '', '', 'N3', '']])
    expect(matchPerks(s.perks, existing).map((p) => p.status)).toEqual(['ambiguous', 'restock', 'new'])
  })
})

describe('smart import: commit', () => {
  it('creates a new perk with its pool and encrypted codes, and restocks an existing one', async () => {
    const db = await storeWithExisting()
    const s = sheet([
      ['Zara', 'Voucher 200', FASHION, 200, 180, 150, 'NEW1', '2026-12-31'], ['Zara', 'Voucher 200', '', '', '', '', 'NEW2', ''],
      ['Fox', 'Gift card 100', '', '', '', '', 'OLD2', ''], ['Fox', 'Gift card 100', '', '', '', '', 'OLD3', ''],
    ])
    const existing = await loadMultipassPerks(db.db as never)
    const results = await commitSmartImport(db.db as never, s.perks, [{ key: s.perks[0]!.key, action: 'create' }, { key: s.perks[1]!.key, action: 'restock', offerId: 'old' }], existing)
    expect(results.map((r) => r.status)).toEqual(['created', 'restocked'])
    const created = results[0]!
    if (created.status !== 'created') throw new Error('expected created')
    expect(created.counts).toMatchObject({ added: 2, duplicates: 0 })
    expect(db.read(`offers/${created.offerId}`)).toMatchObject({ fulfillmentType: 'multipass_pool', perkScope: 'single_business', brandName: 'Zara', businessName: 'Zara', title: 'Voucher 200', originalPrice: 200, offerPrice: 180, category: FASHION, poolId: created.offerId })
    expect(db.read(`offers/${created.offerId}`)).not.toHaveProperty('businessId')
    expect(db.read(`couponPools/${created.offerId}`)).toMatchObject({ totalPurchased: 2, remainingCount: 2, unitCost: 15000, retailPrice: 20000 })
    expect(JSON.stringify(db.snapshot())).not.toContain('"NEW1"')
    expect(results[1]).toMatchObject({ status: 'restocked', offerId: 'old', counts: { added: 1, duplicates: 1 } })
    expect(db.read('couponPools/old')).toMatchObject({ totalPurchased: 3, remainingCount: 3 })
  })

  it('takes missing prices from the admin, and refuses a perk that still lacks them', async () => {
    const db = new TransactionStore()
    const s = sheet([['Zara', 'No prices', FASHION, '', '', '', 'P1', '']])
    const key = s.perks[0]!.key
    const bad = await commitSmartImport(db.db as never, s.perks, [{ key, action: 'create' }], [])
    expect(bad[0]).toMatchObject({ status: 'failed' })
    expect(db.count('offers')).toBe(0)
    const ok = await commitSmartImport(db.db as never, s.perks, [{ key, action: 'create', retailPrice: 100, memberPrice: 80, unitCost: 0 }], [])
    expect(ok[0]).toMatchObject({ status: 'created' })
    const worse = await commitSmartImport(db.db as never, s.perks, [{ key, action: 'create', retailPrice: 100, memberPrice: 120, unitCost: 5 }], [])
    expect(worse[0]).toMatchObject({ status: 'failed' })
  })

  it('removes a new perk entirely when its codes cannot be stored, and carries on with the rest', async () => {
    const db = new TransactionStore()
    const s = sheet([['A', 'Bad one', FASHION, 100, 90, 5, 'X1', ''], ['B', 'Good one', FASHION, 100, 90, 5, 'Y1', '']])
    // Every code of the first perk is already stored under another offer's hash, so nothing can be added.
    const realCreatePool = db.db.runTransaction
    let calls = 0
    db.db.runTransaction = async (work: never) => {
      calls++
      // the first perk's addPoolEntries transaction (its 2nd transaction) fails
      if (calls === 2) throw new Error('boom')
      return realCreatePool(work)
    }
    const results = await commitSmartImport(db.db as never, s.perks, s.perks.map((p) => ({ key: p.key, action: 'create' as const })), [])
    expect(results.map((r) => r.status)).toEqual(['failed', 'created'])
    expect(db.count('offers')).toBe(1)
    expect(Object.keys(db.snapshot()).filter((k) => /^couponPools\/[^/]+$/.test(k))).toHaveLength(1)
    expect(db.read('offers/' + (results[1] as { offerId: string }).offerId)).toMatchObject({ title: 'Good one' })
  })
})

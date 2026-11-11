import { beforeAll, describe, expect, it } from 'vitest'
import { randomBytes } from 'node:crypto'
import { addPoolCodes, createPool } from '@/lib/inventory/poolAdmin'
import { claimOfferForOrder } from '@/lib/payments/claimOfferForOrder'
import { initiateOrder } from '@/lib/payments/initiateOrder'
import { TransactionStore } from '../helpers/transactionStore'
import { offer, terminal } from '../helpers/paymentFixtures'

beforeAll(() => {
  process.env.POOL_CODES_KEY = randomBytes(32).toString('base64')
})

// A Multipass perk belongs to no business document: no businessId anywhere, a brand instead.
const { businessId: _omit, ...base } = offer
void _omit
const multiChain = { ...base, businessName: 'BUYME All Style', totalQuantity: null, fulfillmentType: 'multipass_pool', poolId: 'offer', perkScope: 'multi_chain', brandName: 'BUYME All Style', participatingChains: ['Fox', 'Castro'], chainsCount: 2, universalRedemptionGuide: { he: 'מציגים בקופה', en: 'Show at the till' } }

async function store(offerData: Record<string, unknown>) {
  const db = new TransactionStore()
  db.seed('offers/offer', offerData)
  await createPool(db.db, { offerId: 'offer', warningThreshold: 1, unitCostAgorot: 500, retailPriceAgorot: 1025 })
  await addPoolCodes(db.db, 'offer', ['X1', 'X2'])
  return db
}

describe('Multipass checkout without a business', () => {
  it('creates an order that has no businessId and carries the brand and chains', async () => {
    const db = await store(multiChain)
    await initiateOrder(db.db, 'user', 'offer', terminal)
    const order = db.read('orders/user_offer')!
    expect(order).not.toHaveProperty('businessId')
    expect(order).toMatchObject({ businessName: 'BUYME All Style', fulfillmentType: 'multipass_pool', perkScope: 'multi_chain', brandName: 'BUYME All Style', participatingChains: ['Fox', 'Castro'], chainsCount: 2 })
    expect(order.commissionRate).toBeNull()
  })

  it('settles into a voucher with no businessId, keeping it out of merchant portals and payouts', async () => {
    const db = await store(multiChain)
    await initiateOrder(db.db, 'user', 'offer', terminal)
    await claimOfferForOrder(db.db, { orderId: 'user_offer', terminal, tranzilaTxnId: 't1', approved: true, responseCode: '000', amountAgorot: 1025, currency: 'ILS' })
    const voucher = db.read('vouchers/user_offer')!
    expect(voucher).not.toHaveProperty('businessId')
    expect(voucher).toMatchObject({ externalCode: 'X1', fulfillmentType: 'multipass_pool', payoutBatchId: null, perkScope: 'multi_chain', participatingChains: ['Fox', 'Castro'], businessName: 'BUYME All Style' })
    expect(db.read('orders/user_offer')).toMatchObject({ status: 'paid', voucherId: 'user_offer' })
    // replaying the same notification is recognised, not an error
    await expect(claimOfferForOrder(db.db, { orderId: 'user_offer', terminal, tranzilaTxnId: 't1', approved: true, responseCode: '000', amountAgorot: 1025, currency: 'ILS' })).resolves.toEqual({ alreadyProcessed: true })
  })

  it('still demands a real business for a local-business perk', async () => {
    const db = new TransactionStore()
    db.seed('offers/offer', { ...offer, businessId: 'ghost' })
    await expect(initiateOrder(db.db, 'user', 'offer', terminal)).rejects.toThrow(/business/)
  })
})

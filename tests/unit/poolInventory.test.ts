import { beforeAll, describe, expect, it } from 'vitest'
import { Timestamp } from 'firebase-admin/firestore'
import { randomBytes } from 'node:crypto'
import { decryptField, encryptField } from '@/lib/crypto/fieldCipher'
import { addPoolCodes, addPoolEntries, createPool } from '@/lib/inventory/poolAdmin'
import { claimOfferForOrder } from '@/lib/payments/claimOfferForOrder'
import { TransactionStore } from '../helpers/transactionStore'
import { business, offer, pending, terminal } from '../helpers/paymentFixtures'

beforeAll(() => {
  process.env.POOL_CODES_KEY = randomBytes(32).toString('base64')
  process.env.BUSINESS_FINANCIALS_KEY = randomBytes(32).toString('base64')
})

describe('AES-256-GCM field cipher', () => {
  it('round-trips and never repeats a ciphertext', () => {
    const a = encryptField('POOL_CODES_KEY', 'ABC-123', 'pool/1'), b = encryptField('POOL_CODES_KEY', 'ABC-123', 'pool/1')
    expect(a).not.toBe(b)
    expect(a).not.toContain('ABC-123')
    expect(decryptField('POOL_CODES_KEY', a, 'pool/1')).toBe('ABC-123')
  })
  it('refuses a value moved to another document, a tampered value, or the wrong key', () => {
    const token = encryptField('POOL_CODES_KEY', 'secret', 'pool/1')
    expect(() => decryptField('POOL_CODES_KEY', token, 'pool/2')).toThrow()
    const parts = token.split('.')
    parts[4] = Buffer.from('x' + parts[4]).toString('base64url')
    expect(() => decryptField('POOL_CODES_KEY', parts.join('.'), 'pool/1')).toThrow()
    expect(() => decryptField('BUSINESS_FINANCIALS_KEY', token, 'pool/1')).toThrow()
  })
  it('opens ciphertext from a retired key after rotation', () => {
    const old = process.env.POOL_CODES_KEY!
    const token = encryptField('POOL_CODES_KEY', 'old-secret', 'a')
    process.env.POOL_CODES_KEY_ID = '2'
    process.env.POOL_CODES_KEY_1 = old
    process.env.POOL_CODES_KEY = randomBytes(32).toString('base64')
    try {
      expect(decryptField('POOL_CODES_KEY', token, 'a')).toBe('old-secret')
      expect(encryptField('POOL_CODES_KEY', 'new', 'a').split('.')[1]).toBe('2')
    } finally {
      process.env.POOL_CODES_KEY = old
      delete process.env.POOL_CODES_KEY_ID
      delete process.env.POOL_CODES_KEY_1
    }
  })
})

const poolOffer = { ...offer, totalQuantity: null }
function poolStore(codes: string[]) {
  const db = new TransactionStore()
  db.seed('offers/offer', poolOffer)
  db.seed('businesses/business', business)
  return db.db && { store: db, ready: createPool(db.db, { offerId: 'offer', warningThreshold: 1, unitCostAgorot: 500, retailPriceAgorot: 1025 }).then(() => addPoolCodes(db.db, 'offer', codes)) }
}
const seedOrder = (db: TransactionStore, user: string) =>
  db.seed(`orders/${user}_offer`, { ...pending, userId: user, fulfillmentType: 'multipass_pool', poolId: 'offer' })
const eventFor = (user: string) => ({ orderId: `${user}_offer`, terminal, tranzilaTxnId: `t-${user}`, approved: true, responseCode: '000', amountAgorot: 1025, currency: 'ILS' as const })

describe('Multipass pool', () => {
  it('stores codes encrypted, skips duplicates and blanks, and links the offer', async () => {
    const { store, ready } = poolStore(['A1', 'A2', 'A1', '  ', 'A3'])!
    expect(await ready).toEqual({ added: 3, duplicates: 1, invalid: 1 })
    expect(JSON.stringify(store.snapshot())).not.toContain('"A2"')
    expect(store.read('couponPools/offer')).toMatchObject({ totalPurchased: 3, remainingCount: 3, lowStock: false, status: 'active', lastSeq: 3, nextSeq: 1 })
    expect(store.read('offers/offer')).toMatchObject({ fulfillmentType: 'multipass_pool', poolId: 'offer' })
    // a second upload only adds the new code
    expect(await addPoolCodes(store.db, 'offer', ['A2', 'A4'])).toMatchObject({ added: 1, duplicates: 1 })
  })

  it('hands the next code to the buyer inside the settlement transaction', async () => {
    const { store, ready } = poolStore(['C1', 'C2'])!
    await ready
    seedOrder(store, 'u1')
    await claimOfferForOrder(store.db, eventFor('u1'))
    expect(store.read('vouchers/u1_offer')).toMatchObject({ externalCode: 'C1', fulfillmentType: 'multipass_pool', payoutBatchId: null, amountAgorot: 1025 })
    expect(store.read('couponPools/offer/items/00000001')).toMatchObject({ status: 'allocated', orderId: 'u1_offer', userId: 'u1' })
    expect(store.read('couponPools/offer')).toMatchObject({ allocatedCount: 1, remainingCount: 1, nextSeq: 2, lowStock: true })
  })

  it('never sells one code twice under concurrent purchases, and refuses past sold-out', async () => {
    const { store, ready } = poolStore(['D1', 'D2'])!
    await ready
    for (const u of ['u1', 'u2', 'u3']) seedOrder(store, u)
    const results = await Promise.allSettled(['u1', 'u2', 'u3'].map((u) => claimOfferForOrder(store.db, eventFor(u))))
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(2)
    const codes = ['u1', 'u2', 'u3'].map((u) => store.read(`vouchers/${u}_offer`)?.externalCode).filter(Boolean)
    expect(new Set(codes)).toEqual(new Set(['D1', 'D2']))
    expect(store.read('couponPools/offer')).toMatchObject({ allocatedCount: 2, remainingCount: 0, status: 'depleted' })
    const loser = results.findIndex((r) => r.status === 'rejected')
    expect(store.read(`vouchers/u${loser + 1}_offer`)).toBeUndefined()
  })

  it('skips an expired code and marks it', async () => {
    const { store, ready } = poolStore([])!
    await ready
    await addPoolCodes(store.db, 'offer', ['E1'], new Date(Date.now() - 86_400_000))
    await addPoolCodes(store.db, 'offer', ['E2'])
    seedOrder(store, 'u1')
    await claimOfferForOrder(store.db, eventFor('u1'))
    expect(store.read('vouchers/u1_offer')?.externalCode).toBe('E2')
    expect(store.read('couponPools/offer/items/00000001')?.status).toBe('expired')
    expect(store.read('couponPools/offer')).toMatchObject({ remainingCount: 0, nextSeq: 3 })
  })

  it('stores spreadsheet rows with their own expiry and an encrypted PIN, and hands the PIN to the buyer', async () => {
    const { store, ready } = poolStore([])!
    await ready
    const result = await addPoolEntries(store.db, 'offer', [
      { code: 'S1', pin: '4321', expiresAt: new Date(Date.now() - 86_400_000) },
      { code: 'S2', pin: '9876', expiresAt: new Date(Date.now() + 86_400_000) },
      { code: 'S2', pin: '0000' },
      { code: '', pin: '1' },
    ])
    expect(result).toEqual({ added: 2, duplicates: 1, invalid: 1 })
    const text = JSON.stringify(store.snapshot())
    for (const secret of ['"S1"', '"S2"', '4321', '9876']) expect(text).not.toContain(secret)
    seedOrder(store, 'u1')
    await claimOfferForOrder(store.db, eventFor('u1'))
    // S1 had expired, so the buyer gets S2 together with its PIN.
    expect(store.read('vouchers/u1_offer')?.externalCode).toBe('S2 · PIN 9876')
  })
})

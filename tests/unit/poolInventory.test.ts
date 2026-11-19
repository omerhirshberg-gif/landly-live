import { beforeAll, describe, expect, it } from 'vitest'
import { Timestamp } from 'firebase-admin/firestore'
import { randomBytes } from 'node:crypto'
import { decryptField, encryptField } from '@/lib/crypto/fieldCipher'
import { addPoolCodes, createSharedPool, linkOfferToPool } from '@/lib/inventory/poolAdmin'
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
const FACE = 2000
const PRICE = 1025
// One shared stock (a 20 ILS voucher sold for 10.25) that any number of offers can draw from.
async function poolStore(codes: string[], offers = ['offer']) {
  const store = new TransactionStore()
  store.seed('businesses/business', business)
  for (const id of offers) store.seed(`offers/${id}`, poolOffer)
  const poolId = await createSharedPool(store.db as never, { title: 'Raayonit - Tav Al 20', faceValueAgorot: FACE, priceAgorot: PRICE, warningThreshold: 1, unitCostAgorot: 0 })
  for (const id of offers) await linkOfferToPool(store.db as never, id, poolId)
  const added = await addPoolCodes(store.db as never, poolId, codes)
  return { store, poolId, added }
}
const seedOrder = (db: TransactionStore, user: string, poolId: string, offerId = 'offer') =>
  db.seed(`orders/${user}_${offerId}`, { ...pending, userId: user, offerId, fulfillmentType: 'raayonit_pool', poolId })
const eventFor = (user: string, offerId = 'offer') => ({ orderId: `${user}_${offerId}`, terminal, tranzilaTxnId: `t-${user}-${offerId}`, approved: true, responseCode: '000', amountAgorot: PRICE, currency: 'ILS' as const })

describe('Raayonit shared voucher stock', () => {
  it('stores codes encrypted, skips duplicates and blanks, and links the offer', async () => {
    const { store, poolId, added } = await poolStore(['A1', 'A2', 'A1', '  ', 'A3'])
    expect(added).toEqual({ added: 3, duplicates: 1, invalid: 1 })
    expect(JSON.stringify(store.snapshot())).not.toContain('"A2"')
    expect(store.read(`couponPools/${poolId}`)).toMatchObject({ kind: 'shared', provider: 'raayonit', faceValueAgorot: FACE, priceAgorot: PRICE, unitCost: 0, totalPurchased: 3, remainingCount: 3, lowStock: false, status: 'active', lastSeq: 3, nextSeq: 1 })
    expect(store.read('offers/offer')).toMatchObject({ fulfillmentType: 'raayonit_pool', poolId, totalQuantity: null })
    // a restock only adds the new code
    expect(await addPoolCodes(store.db as never, poolId, ['A2', 'A4'])).toMatchObject({ added: 1, duplicates: 1 })
  })

  it('allows one stock per voucher value', async () => {
    const { store } = await poolStore(['A1'])
    await expect(createSharedPool(store.db as never, { title: 'again', faceValueAgorot: FACE, priceAgorot: PRICE, warningThreshold: 1, unitCostAgorot: 0 })).rejects.toThrow(/already exists/)
    await expect(createSharedPool(store.db as never, { title: 'bad', faceValueAgorot: 1000, priceAgorot: 2000, warningThreshold: 1, unitCostAgorot: 0 })).rejects.toThrow(/no more than/)
  })

  it('hands the next code to the buyer and gives the voucher five years, no QR and its issuer', async () => {
    const { store, poolId } = await poolStore(['C1', 'C2'])
    seedOrder(store, 'u1', poolId)
    await claimOfferForOrder(store.db as never, eventFor('u1'))
    const voucher = store.read('vouchers/u1_offer')!
    expect(voucher).toMatchObject({ externalCode: 'C1', fulfillmentType: 'raayonit_pool', payoutBatchId: null, amountAgorot: PRICE, redemptionKind: 'code_only', faceValueAgorot: FACE, issuer: { id: 'raayonit', nameEn: 'Raayonit Ltd.' } })
    const takenAt = (voucher.takenAt as Timestamp).toDate()
    const expires = (voucher.expiresAt as Timestamp).toDate()
    expect(expires.getUTCFullYear()).toBe(takenAt.getUTCFullYear() + 5)
    expect(expires.getTime()).toBeGreaterThan(takenAt.getTime() + 5 * 365 * 86_400_000)
    expect(store.read(`couponPools/${poolId}/items/00000001`)).toMatchObject({ status: 'allocated', orderId: 'u1_offer', userId: 'u1' })
    expect(store.read(`couponPools/${poolId}`)).toMatchObject({ allocatedCount: 1, remainingCount: 1, nextSeq: 2, lowStock: true })
  })

  it('serves several offers from the same codes without ever repeating one', async () => {
    const { store, poolId } = await poolStore(['M1', 'M2', 'M3'], ['fox', 'castro'])
    seedOrder(store, 'u1', poolId, 'fox')
    seedOrder(store, 'u2', poolId, 'castro')
    seedOrder(store, 'u3', poolId, 'fox')
    const results = await Promise.allSettled([
      claimOfferForOrder(store.db as never, eventFor('u1', 'fox')),
      claimOfferForOrder(store.db as never, eventFor('u2', 'castro')),
      claimOfferForOrder(store.db as never, eventFor('u3', 'fox')),
    ])
    expect(results.every((r) => r.status === 'fulfilled')).toBe(true)
    const codes = [['u1', 'fox'], ['u2', 'castro'], ['u3', 'fox']].map(([u, o]) => store.read(`vouchers/${u}_${o}`)?.externalCode)
    expect(new Set(codes)).toEqual(new Set(['M1', 'M2', 'M3']))
    expect(store.read(`couponPools/${poolId}`)).toMatchObject({ allocatedCount: 3, remainingCount: 0, status: 'depleted' })
  })

  it('never sells one code twice under concurrent purchases, and refuses past sold-out', async () => {
    const { store, poolId } = await poolStore(['D1', 'D2'])
    for (const u of ['u1', 'u2', 'u3']) seedOrder(store, u, poolId)
    const results = await Promise.allSettled(['u1', 'u2', 'u3'].map((u) => claimOfferForOrder(store.db as never, eventFor(u))))
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(2)
    const codes = ['u1', 'u2', 'u3'].map((u) => store.read(`vouchers/${u}_offer`)?.externalCode).filter(Boolean)
    expect(new Set(codes)).toEqual(new Set(['D1', 'D2']))
    expect(store.read(`couponPools/${poolId}`)).toMatchObject({ allocatedCount: 2, remainingCount: 0, status: 'depleted' })
    const loser = results.findIndex((r) => r.status === 'rejected')
    expect(store.read(`vouchers/u${loser + 1}_offer`)).toBeUndefined()
  })

  it('refuses an offer that is not linked to the stock', async () => {
    const { store } = await poolStore(['Z1'])
    store.seed('couponPools/legacy', { offerId: 'someone-else', status: 'active', nextSeq: 1, lastSeq: 1, allocatedCount: 0, remainingCount: 1 })
    store.seed('orders/u9_offer', { ...pending, userId: 'u9', fulfillmentType: 'raayonit_pool', poolId: 'legacy' })
    await expect(claimOfferForOrder(store.db as never, eventFor('u9'))).rejects.toThrow()
  })
})

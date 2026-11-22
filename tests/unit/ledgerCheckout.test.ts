import { beforeAll, describe, expect, it, vi } from 'vitest'
import { Timestamp } from 'firebase-admin/firestore'
import { randomBytes } from 'node:crypto'
import { claimOfferForOrder } from '@/lib/payments/claimOfferForOrder'
import { initiateOrder } from '@/lib/payments/initiateOrder'
import { encryptVoucherCode, hashCode, decryptVoucherCode } from '@/lib/inventory/ledger/codes'
import { releaseReservation } from '@/lib/inventory/ledger/stock'
import { TransactionStore } from '../helpers/transactionStore'
import { offer, terminal } from '../helpers/paymentFixtures'

vi.mock('@/lib/firebase/config', () => ({ db: {}, auth: {} }))
beforeAll(() => { process.env.POOL_CODES_KEY = randomBytes(32).toString('base64') })

const { businessId: _omit, ...base } = offer
void _omit
const T = Timestamp.fromMillis(Date.UTC(2026, 5, 1))

function store(codes: string[]) {
  const db = new TransactionStore()
  db.seed('inventoryProducts/p100', { supplierId: 'raayonit', title: '100', faceValueAgorot: 10000, salePriceAgorot: 8900, issueMode: 'stock', active: true, lowStockThreshold: 1 })
  for (const code of codes) {
    const id = hashCode(code)
    db.seed(`inventoryVouchers/${id}`, {
      productId: 'p100', supplierId: 'raayonit', codeEncrypted: encryptVoucherCode(code, id), codeHash: id, status: 'IN_STOCK', faceValueAgorot: 10000, balanceAgorot: 10000,
      expiresAt: null, importBatchId: 'b', orderItemId: null, supplierRef: null, reservedUntil: null, reservedForOrderId: null, soldAt: null, createdAt: T, updatedAt: T,
    })
  }
  db.seed('offers/offer', {
    ...base, fulfillmentType: 'raayonit_pool', perkScope: 'multi_chain', brandName: 'Multi', businessName: 'Multi', title: 'Multi', totalQuantity: null, offerPrice: 89, originalPrice: 100,
    poolId: 'p100', variants: [{ faceValueAgorot: 10000, priceAgorot: 8900, poolId: 'p100' }],
  })
  return db
}
const events = (db: TransactionStore) => Object.entries(db.snapshot()).filter(([k]) => k.startsWith('voucherEvents/')).map(([, v]) => v as Record<string, any>)
type V = { id: string; [key: string]: any }
const vouchers = (db: TransactionStore): V[] => Object.entries(db.snapshot()).filter(([k]) => k.startsWith('inventoryVouchers/')).map(([k, v]) => ({ id: k.split('/')[1]!, ...(v as Record<string, any>) }))
const pay = (orderId: string, approved = true, txn = 't1') => ({ orderId, terminal, tranzilaTxnId: txn, approved, responseCode: approved ? '000' : '033', amountAgorot: 8900, currency: 'ILS' as const })

describe('a ledger-backed Raayonit sale', () => {
  it('reserves at checkout, then sells and delivers atomically after the payment, leaving the full event trail', async () => {
    const db = store(['AAAA-0001-XXXX', 'BBBB-0002-YYYY'])
    const order = await initiateOrder(db.db, 'u1', 'offer', terminal, { variantPoolId: 'p100' })
    const reserved = vouchers(db).filter((v) => v.status === 'RESERVED')
    expect(reserved).toHaveLength(1)
    expect(reserved[0]).toMatchObject({ reservedForOrderId: order.orderId })
    expect(db.read(`orders/${order.orderId}`)).toMatchObject({ inventoryProductId: 'p100', reservedVoucherId: reserved[0]!.id })

    await claimOfferForOrder(db.db, pay(order.orderId))
    const sold = vouchers(db).find((v) => v.id === reserved[0]!.id)!
    expect(sold).toMatchObject({ status: 'DELIVERED', balanceAgorot: 10000, orderItemId: order.orderId, reservedUntil: null, reservedForOrderId: null })
    expect((sold.expiresAt as Timestamp).toDate().getUTCFullYear()).toBe(new Date().getUTCFullYear() + 5)
    expect(events(db).filter((e) => e.voucherId === sold.id).map((e) => e.type)).toEqual(['RESERVED', 'SOLD', 'DELIVERED'])
    const wallet = db.read(`vouchers/${order.orderId}`)!
    expect(wallet).toMatchObject({ inventoryVoucherId: sold.id, redemptionKind: 'code_only', faceValueAgorot: 10000 })
    expect(['AAAA-0001-XXXX', 'BBBB-0002-YYYY']).toContain(wallet.externalCode)
    expect(decryptVoucherCode(sold.codeEncrypted, sold.id)).toBe(wallet.externalCode)
    // The other code is untouched.
    expect(vouchers(db).filter((v) => v.status === 'IN_STOCK')).toHaveLength(1)
  })

  it('refuses a third buyer when two codes are held, and each buyer gets a different code', async () => {
    const db = store(['AAAA-0001-XXXX', 'BBBB-0002-YYYY'])
    const [a, b] = await Promise.all([initiateOrder(db.db, 'u1', 'offer', terminal, { variantPoolId: 'p100' }), initiateOrder(db.db, 'u2', 'offer', terminal, { variantPoolId: 'p100' })])
    await expect(initiateOrder(db.db, 'u3', 'offer', terminal, { variantPoolId: 'p100' })).rejects.toThrow(/out of stock/)
    await claimOfferForOrder(db.db, pay(a.orderId, true, 'ta'))
    await claimOfferForOrder(db.db, pay(b.orderId, true, 'tb'))
    expect(db.read(`vouchers/${a.orderId}`)!.externalCode).not.toBe(db.read(`vouchers/${b.orderId}`)!.externalCode)
  })

  it('a declined payment releases the held code back to stock', async () => {
    const db = store(['AAAA-0001-XXXX'])
    const order = await initiateOrder(db.db, 'u1', 'offer', terminal, { variantPoolId: 'p100' })
    await claimOfferForOrder(db.db, pay(order.orderId, false))
    expect(vouchers(db)[0]).toMatchObject({ status: 'IN_STOCK', reservedForOrderId: null })
    expect(events(db).map((e) => e.type)).toEqual(['RESERVED', 'RELEASED'])
    expect(db.read(`vouchers/${order.orderId}`)).toBeUndefined()
  })

  it('a replayed webhook sells nothing twice', async () => {
    const db = store(['AAAA-0001-XXXX', 'BBBB-0002-YYYY'])
    const order = await initiateOrder(db.db, 'u1', 'offer', terminal, { variantPoolId: 'p100' })
    await claimOfferForOrder(db.db, pay(order.orderId))
    const replay = await claimOfferForOrder(db.db, pay(order.orderId))
    expect(replay.alreadyProcessed).toBe(true)
    expect(vouchers(db).filter((v) => v.status === 'DELIVERED')).toHaveLength(1)
  })

  it('a buyer who pays after the 15 minutes (hold released) still gets a code', async () => {
    const db = store(['AAAA-0001-XXXX'])
    const order = await initiateOrder(db.db, 'u1', 'offer', terminal, { variantPoolId: 'p100' })
    await releaseReservation(db.db, order.orderId)
    expect(vouchers(db)[0]!.status).toBe('IN_STOCK')
    await claimOfferForOrder(db.db, pay(order.orderId))
    expect(vouchers(db)[0]!.status).toBe('DELIVERED')
    expect(events(db).map((e) => e.type)).toEqual(['RESERVED', 'RELEASED', 'RESERVED', 'SOLD', 'DELIVERED'])
  })

  it('an unpaid reload keeps the same held code', async () => {
    const db = store(['AAAA-0001-XXXX', 'BBBB-0002-YYYY'])
    const first = await initiateOrder(db.db, 'u1', 'offer', terminal, { variantPoolId: 'p100' })
    const held = vouchers(db).find((v) => v.status === 'RESERVED')!.id
    await initiateOrder(db.db, 'u1', 'offer', terminal, { variantPoolId: 'p100' })
    expect(vouchers(db).filter((v) => v.status === 'RESERVED').map((v) => v.id)).toEqual([held])
    expect(first.orderId).toBe('u1_offer_p100')
  })
})

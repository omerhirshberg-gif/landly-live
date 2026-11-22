import { beforeAll, describe, expect, it, vi } from 'vitest'
import { randomBytes } from 'node:crypto'
import { claimOfferForOrder } from '@/lib/payments/claimOfferForOrder'
import { initiateOrder } from '@/lib/payments/initiateOrder'
import { decryptVoucherCode, hashCode } from '@/lib/inventory/ledger/codes'
import { SupplierNotConfiguredError, SupplierRequestError, withRetry } from '@/lib/inventory/suppliers/SupplierAdapter'
import { MultipassAdapter, multipassConfig } from '@/lib/inventory/suppliers/MultipassAdapter'
import { TransactionStore } from '../helpers/transactionStore'
import { business, offer, terminal } from '../helpers/paymentFixtures'

const issue = vi.hoisted(() => vi.fn())
vi.mock('@/lib/firebase/config', () => ({ db: {}, auth: {} }))
vi.mock('@/lib/inventory/suppliers', () => ({ getSupplierAdapter: () => ({ issue }) }))
beforeAll(() => { process.env.POOL_CODES_KEY = randomBytes(32).toString('base64') })

function store() {
  const db = new TransactionStore()
  db.seed('inventoryProducts/mp1', { supplierId: 'multipass', title: 'Cafe 50', businessId: 'business', faceValueAgorot: 5000, salePriceAgorot: 4500, issueMode: 'dynamic', active: true })
  db.seed('offers/offer', { ...offer, fulfillmentType: 'direct_merchant', inventoryProductId: 'mp1', offerPrice: 45, originalPrice: 50, totalQuantity: null })
  db.seed('businesses/business', business)
  return db
}
const pay = (orderId: string) => ({ orderId, terminal, tranzilaTxnId: 'tx', approved: true, responseCode: '000', amountAgorot: 4500, currency: 'ILS' as const })

describe('direct Multipass issuance at the sale', () => {
  it('issues through the adapter once per order and writes the voucher and its events in the settlement transaction', async () => {
    issue.mockReset().mockResolvedValue({ code: 'MP-CODE-998877', supplierRef: 'mp-ref-1', expiresAt: null })
    const db = store()
    const order = await initiateOrder(db.db, 'user', 'offer', terminal)
    // A dynamic product holds nothing at checkout.
    expect(Object.keys(db.snapshot()).filter((k) => k.startsWith('inventoryVouchers/'))).toHaveLength(0)
    expect(db.read(`orders/${order.orderId}`)).toMatchObject({ inventoryProductId: 'mp1' })

    await claimOfferForOrder(db.db, pay(order.orderId))
    expect(issue).toHaveBeenCalledTimes(1)
    expect(issue.mock.calls[0]![0]).toMatchObject({ orderId: order.orderId, productId: 'mp1', faceValueAgorot: 5000, businessId: 'business', externalEventId: `order:${order.orderId}` })
    const id = hashCode('MP-CODE-998877')
    const v = db.read(`inventoryVouchers/${id}`)!
    expect(v).toMatchObject({ status: 'DELIVERED', supplierId: 'multipass', productId: 'mp1', supplierRef: 'mp-ref-1', balanceAgorot: 5000, orderItemId: order.orderId })
    expect(decryptVoucherCode(v.codeEncrypted, id)).toBe('MP-CODE-998877')
    const evs = Object.values(db.snapshot()).filter((x: any) => x.voucherId === id).map((x: any) => `${x.type}:${x.source}`)
    expect(evs).toEqual(['ISSUED:multipass', 'DELIVERED:multipass'])
    expect(db.read(`vouchers/${order.orderId}`)).toMatchObject({ inventoryVoucherId: id, externalCode: 'MP-CODE-998877', businessId: 'business' })
  })

  it('a supplier failure leaves the order unsettled for reconciliation and creates nothing', async () => {
    issue.mockReset().mockRejectedValue(new SupplierRequestError('multipass', 503))
    const db = store()
    const order = await initiateOrder(db.db, 'user', 'offer', terminal)
    await expect(claimOfferForOrder(db.db, pay(order.orderId))).rejects.toThrow(/reconciliation/)
    expect(db.read(`orders/${order.orderId}`)!.status).toBe('pending')
    expect(db.read(`vouchers/${order.orderId}`)).toBeUndefined()
  })
})

describe('supplier adapters', () => {
  it('Multipass fails closed until it is enabled and configured', async () => {
    expect(multipassConfig({} as NodeJS.ProcessEnv)).toBeNull()
    expect(multipassConfig({ MULTIPASS_ENABLED: '1', MULTIPASS_API_BASE_URL: 'https://x' } as unknown as NodeJS.ProcessEnv)).toBeNull()
    expect(multipassConfig({ MULTIPASS_ENABLED: '1', MULTIPASS_API_BASE_URL: 'https://x/', MULTIPASS_API_KEY: 'k' } as unknown as NodeJS.ProcessEnv)).toEqual({ baseUrl: 'https://x', apiKey: 'k' })
    await expect(new MultipassAdapter({ config: null }).issue({ orderId: 'o', productId: 'p', faceValueAgorot: 1, externalEventId: 'e' })).rejects.toBeInstanceOf(SupplierNotConfiguredError)
  })
  it('sends the idempotency key and retries only transient failures with backoff', async () => {
    const calls: { headers: Record<string, string> }[] = []
    let n = 0
    const fetcher = (async (_url: string, init: { headers: Record<string, string> }) => {
      calls.push(init)
      return ++n < 3 ? new Response('', { status: 503 }) : new Response(JSON.stringify({ code: 'C', id: 'R' }), { status: 200 })
    }) as unknown as typeof fetch
    const waits: number[] = []
    const a = new MultipassAdapter({ fetcher, config: { baseUrl: 'https://x', apiKey: 'k' }, sleep: async (ms) => { waits.push(ms) } })
    const out = await a.issue({ orderId: 'o', productId: 'p', faceValueAgorot: 100, externalEventId: 'order:o' })
    expect(out).toMatchObject({ code: 'C', supplierRef: 'R' })
    expect(calls).toHaveLength(3)
    expect(calls.every((c) => c.headers['idempotency-key'] === 'order:o' && c.headers.authorization === 'Bearer k')).toBe(true)
    expect(waits).toHaveLength(2)
    expect(waits[1]!).toBeGreaterThan(waits[0]! - 400)
  })
  it('does not retry a client error', async () => {
    const op = vi.fn(async () => { throw new SupplierRequestError('multipass', 400) })
    await expect(withRetry(op, { sleep: async () => {} })).rejects.toBeInstanceOf(SupplierRequestError)
    expect(op).toHaveBeenCalledTimes(1)
  })
})

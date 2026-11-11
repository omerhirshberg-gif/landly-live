import { beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { Timestamp } from 'firebase-admin/firestore'
import { randomBytes } from 'node:crypto'
import { encryptField } from '@/lib/crypto/fieldCipher'
import { masavConfig } from '@/lib/finance/masavGenerator'
import { SettlementError, createPayoutBatch, markPayoutPaid, planSettlement, previewSettlement, voidPayoutBatch, type FileStore } from '@/lib/finance/settlement'
import { TransactionStore } from '../helpers/transactionStore'

beforeAll(() => { process.env.BUSINESS_FINANCIALS_KEY = randomBytes(32).toString('base64') })

const day = (iso: string) => Timestamp.fromDate(new Date(`${iso}T09:00:00+02:00`))
const voucher = (over: Record<string, unknown> = {}) => ({
  status: 'redeemed', fulfillmentType: 'direct_merchant', payoutBatchId: null, businessId: 'b1', amountAgorot: 10000,
  commissionRate: 0.1, paymentTerms: 'net_30', redeemedAt: day('2026-10-01'), ...over,
})
const enc = (biz: string, field: string, v: string) => encryptField('BUSINESS_FINANCIALS_KEY', v, `businessFinancials/${biz}:${field}`)
const financials = (biz: string, over: Record<string, string> = {}) => {
  const v = { taxId: '123456782', bankCode: '12', branch: '600', account: '123456', ...over }
  return { taxIdCipher: enc(biz, 'taxId', v.taxId), bankCodeCipher: enc(biz, 'bankCode', v.bankCode), branchCipher: enc(biz, 'branch', v.branch), accountCipher: enc(biz, 'account', v.account) }
}

describe('planSettlement', () => {
  const facts = (id: string, over: Record<string, unknown> = {}) => ({ id, businessId: 'b1', amountAgorot: 10000, commissionRate: 0.1, paymentTerms: 'net_30', redeemedAt: day('2026-10-01'), ...over })
  const names = new Map([['b1', 'Cafe']])
  it('pays only what the terms have released, net of commission', () => {
    const plan = planSettlement('2026-11-30', [facts('a'), facts('b', { redeemedAt: day('2026-11-15') }), facts('c', { paymentTerms: 'net_0', redeemedAt: day('2026-11-30') })], names, () => 'ok')
    expect(plan.lines[0]).toMatchObject({ voucherIds: ['a', 'c'], grossAgorot: 20000, commissionAgorot: 2000, netAgorot: 18000, notYetDue: 1, blocked: null })
    expect(plan.readyNetAgorot).toBe(18000)
  })
  it('rounds commission per voucher so lines add up', () => {
    const plan = planSettlement('2026-11-30', [facts('a', { amountAgorot: 1025 }), facts('b', { amountAgorot: 1025 })], names, () => 'ok')
    expect(plan.lines[0]).toMatchObject({ commissionAgorot: 206, netAgorot: 1844 })
  })
  it('holds back a merchant with missing terms, an unknown amount, or no usable bank details', () => {
    expect(planSettlement('2026-11-30', [facts('a', { paymentTerms: null })], names, () => 'ok').lines[0]!.blocked).toBe('missing_terms')
    expect(planSettlement('2026-11-30', [facts('a', { amountAgorot: undefined })], names, () => 'ok').lines[0]!.blocked).toBe('missing_amount')
    expect(planSettlement('2026-11-30', [facts('a')], names, () => 'missing').lines[0]!.blocked).toBe('missing_bank_details')
    expect(planSettlement('2026-11-30', [facts('a')], names, () => 'invalid').lines[0]!.blocked).toBe('invalid_bank_details')
    expect(planSettlement('2026-11-30', [facts('a', { redeemedAt: day('2026-11-25') })], names, () => 'ok').lines[0]!.blocked).toBe('nothing_due')
  })
})

describe('payout batches', () => {
  let store: TransactionStore
  let files: Record<string, Uint8Array>
  const fileStore: FileStore = { save: async (p, b) => { files[p] = b }, read: async (p) => files[p]! }
  const request = new Request('https://landly.test')
  const now = new Date('2026-11-11T10:00:00Z')
  const mock = masavConfig({})

  beforeEach(() => {
    files = {}
    store = new TransactionStore()
    store.seed('businesses/b1', { businessName: 'Cafe', legalName: 'Cafe Example Ltd' })
    store.seed('businessFinancials/b1', financials('b1'))
    store.seed('businesses/b2', { businessName: 'Shop' })
    store.seed('businessFinancials/b2', financials('b2', { bankCode: '10', account: '4567' }))
    store.seed('vouchers/v1', voucher())
    store.seed('vouchers/v2', voucher({ amountAgorot: 5000 }))
    store.seed('vouchers/v3', voucher({ businessId: 'b2', amountAgorot: 20000, commissionRate: 0.15 }))
    // Never in a payout: not redeemed, multipass, already batched, refunded, not yet due.
    store.seed('vouchers/x1', voucher({ status: 'active' }))
    store.seed('vouchers/x2', voucher({ fulfillmentType: 'multipass_pool' }))
    store.seed('vouchers/x3', voucher({ payoutBatchId: 'old' }))
    store.seed('vouchers/x4', voucher({ status: 'refunded' }))
    store.seed('vouchers/x5', voucher({ redeemedAt: day('2026-11-20') }))
  })

  it('previews without writing anything', async () => {
    const before = store.snapshot()
    const preview = await previewSettlement(store.db, '2026-11-30')
    expect(preview).toMatchObject({ readyCount: 2, readyVouchers: 3, readyNetAgorot: 13500 + 17000 })
    expect(store.snapshot()).toEqual(before)
  })

  it('locks the right vouchers, writes a 128-column mock file and records the batch', async () => {
    const created = await createPayoutBatch(store.db, fileStore, request, '2026-11-30', now, mock)
    expect(created).toMatchObject({ voucherCount: 3, totalAgorot: 30500, mock: true })
    expect(created.fileName).toMatch(/^MASAV_MOCK_TEST_\d{14}\.dat$/)
    for (const id of ['v1', 'v2', 'v3']) expect(store.read(`vouchers/${id}`)?.payoutBatchId).toBe(created.batchId)
    expect(store.read('vouchers/x1')?.payoutBatchId).toBeNull()
    expect(store.read('vouchers/x2')?.payoutBatchId).toBeNull()
    expect(store.read('vouchers/x3')?.payoutBatchId).toBe('old')
    expect(store.read('vouchers/x5')?.payoutBatchId).toBeNull()
    const text = Buffer.from(files[`payouts/${created.batchId}/${created.fileName}`]!).toString('latin1')
    const lines = text.split('\r\n').slice(0, -1)
    expect(lines.map((l) => l[0])).toEqual(['K', '1', '1', '5'])
    expect(lines.every((l) => l.length === 128)).toBe(true)
    expect(lines[1]!.slice(36, 45)).toBe('123456782')
    expect(lines[1]!.slice(61, 74)).toBe('0000000013500')
    expect(lines[2]!.slice(26, 35)).toBe('000004567')
    expect(lines[3]!.slice(21, 36)).toBe('000000000030500')
    expect(store.read(`payoutBatches/${created.batchId}`)).toMatchObject({ status: 'file_generated', voucherCount: 3, mock: true, institutionCodeUsed: '99999999' })
    expect(store.read(`payoutBatches/${created.batchId}/lines/b1`)).toMatchObject({ netAgorot: 13500, voucherIds: ['v1', 'v2'] })
    expect(JSON.stringify(store.snapshot())).not.toContain('123456')
  })

  it('never pays a voucher twice: a second run finds nothing', async () => {
    await createPayoutBatch(store.db, fileStore, request, '2026-11-30', now, mock)
    await expect(createPayoutBatch(store.db, fileStore, request, '2026-11-30', now, mock)).rejects.toThrow('Nothing is ready')
  })

  it('releases everything when a voucher changes while locking', async () => {
    store.beforeCommit = async () => { store.seed('vouchers/v3', { ...store.read('vouchers/v3'), status: 'refunded' }) }
    await expect(createPayoutBatch(store.db, fileStore, request, '2026-11-30', now, mock)).rejects.toBeInstanceOf(SettlementError)
    for (const id of ['v1', 'v2', 'v3']) expect(store.read(`vouchers/${id}`)?.payoutBatchId).toBeNull()
    expect(Object.keys(files)).toHaveLength(0)
  })

  it('holds back a merchant without bank details but pays the others', async () => {
    // A copy of the store without b2's financials.
    const snap = store.snapshot(); delete snap['businessFinancials/b2']
    const fresh = new TransactionStore(); Object.entries(snap).forEach(([k, v]) => fresh.seed(k, v as never))
    const created = await createPayoutBatch(fresh.db, fileStore, request, '2026-11-30', now, mock)
    expect(created.voucherCount).toBe(2)
    expect(fresh.read('vouchers/v3')?.payoutBatchId).toBeNull()
  })

  it('voids a batch and frees its vouchers, but not once marked paid', async () => {
    const created = await createPayoutBatch(store.db, fileStore, request, '2026-11-30', now, mock)
    await voidPayoutBatch(store.db, request, created.batchId)
    for (const id of ['v1', 'v2', 'v3']) expect(store.read(`vouchers/${id}`)?.payoutBatchId).toBeNull()
    expect(store.read(`payoutBatches/${created.batchId}`)?.status).toBe('void')
    const again = await createPayoutBatch(store.db, fileStore, request, '2026-11-30', now, mock)
    await markPayoutPaid(store.db, request, again.batchId)
    await expect(voidPayoutBatch(store.db, request, again.batchId)).rejects.toThrow('already marked paid')
  })

  it('rejects dates in the past or too far ahead', async () => {
    await expect(createPayoutBatch(store.db, fileStore, request, '2026-11-01', now, mock)).rejects.toThrow('within the next 60 days')
    await expect(createPayoutBatch(store.db, fileStore, request, 'soon', now, mock)).rejects.toThrow('valid payment date')
  })
})

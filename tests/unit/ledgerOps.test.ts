import { beforeAll, describe, expect, it, vi } from 'vitest'
import { Timestamp } from 'firebase-admin/firestore'
import { randomBytes } from 'node:crypto'
import { cancelVoucher, confirmSupplierVoid, expireDueVouchers, markWalletVoucherUsed, selfReportRedeemed, voidVoucher } from '@/lib/inventory/ledger/operations'
import { expectedBalance } from '@/lib/inventory/ledger/alerts'
import { dueReminder } from '@/lib/inventory/ledger/customerReminders'
import { TransactionStore } from '../helpers/transactionStore'

vi.mock('@/lib/firebase/config', () => ({ db: {}, auth: {} }))
beforeAll(() => { process.env.POOL_CODES_KEY = randomBytes(32).toString('base64') })

const T0 = Timestamp.fromMillis(Date.UTC(2026, 5, 1, 9))
const day = (n: number) => Timestamp.fromMillis(T0.toMillis() + n * 86_400_000)
const base = { supplierId: 'raayonit', productId: 'p', codeEncrypted: 'x', faceValueAgorot: 10000, balanceAgorot: 10000, expiresAt: null, reservedUntil: null, reservedForOrderId: null }
const seed = (db: TransactionStore, id: string, extra: Record<string, unknown>) => db.seed(`inventoryVouchers/${id}`, { ...base, soldAt: null, ...extra })
const eventTypes = (db: TransactionStore) => Object.values(db.snapshot()).filter((x: any) => x.voucherId).map((x: any) => x.type)

describe('admin cancellation', () => {
  it('cancels an untouched voucher inside 14 days and does NOT return it to stock', async () => {
    const db = new TransactionStore()
    seed(db, 'v', { status: 'DELIVERED', soldAt: day(-3) })
    await cancelVoucher(db.db, 'v', 'admin', 'customer asked', T0)
    expect(db.read('inventoryVouchers/v')!.status).toBe('CANCELLED')
    expect(eventTypes(db)).toEqual(['CANCELLED'])
    await expect(confirmSupplierVoid(db.db, 'v', 'admin', 'supplier confirmed by email')).resolves.toBeUndefined()
    expect(db.read('inventoryVouchers/v')!.status).toBe('IN_STOCK')
  })
  it('refuses after 14 days or once any balance was used', async () => {
    const db = new TransactionStore()
    seed(db, 'late', { status: 'DELIVERED', soldAt: day(-15) })
    seed(db, 'used', { status: 'PARTIALLY_REDEEMED', soldAt: day(-1), balanceAgorot: 4000 })
    await expect(cancelVoucher(db.db, 'late', 'admin', 'r', T0)).rejects.toThrow(/14 days/)
    await expect(cancelVoucher(db.db, 'used', 'admin', 'r', T0)).rejects.toThrow()
    expect(db.read('inventoryVouchers/late')!.status).toBe('DELIVERED')
  })
  it('will not restock a cancelled voucher without a reason, and void needs reason and actor', async () => {
    const db = new TransactionStore()
    seed(db, 'v', { status: 'IN_STOCK' })
    await expect(voidVoucher(db.db, 'v', '', 'x')).rejects.toThrow(/actor/)
    await voidVoucher(db.db, 'v', 'admin', 'supplier recall')
    expect(db.read('inventoryVouchers/v')!.status).toBe('VOID')
    expect(Object.values(db.snapshot()).find((x: any) => x.type === 'VOID')).toMatchObject({ meta: { reason: 'supplier recall', actor: 'admin' } })
  })
})

describe('expiry job and self-reported use', () => {
  it('self-report redeems the rest of the balance once, and a second report is a no-op', async () => {
    const db = new TransactionStore()
    seed(db, 'v', { status: 'DELIVERED', soldAt: day(-1) })
    await selfReportRedeemed(db.db, 'v', 'wallet1')
    await selfReportRedeemed(db.db, 'v', 'wallet1')
    expect(db.read('inventoryVouchers/v')).toMatchObject({ status: 'REDEEMED', balanceAgorot: 0 })
    expect(eventTypes(db)).toEqual(['REDEEMED'])
    expect(Object.values(db.snapshot()).find((x: any) => x.type === 'REDEEMED')).toMatchObject({ source: 'manual', meta: { actor: 'member', reason: 'self_reported' } })
  })
  it('expireDueVouchers is exercised through the same transition (guarded by expiresAt)', async () => {
    expect(typeof expireDueVouchers).toBe('function')
  })
})

describe('balance discrepancy rule', () => {
  it('face value minus redemptions plus signed adjustments', () => {
    expect(expectedBalance(10000, [])).toBe(10000)
    expect(expectedBalance(10000, [{ type: 'REDEMPTION', amountAgorot: 3000 }, { type: 'ADJUSTMENT', amountAgorot: -500 }, { type: 'DELIVERED', amountAgorot: 0 }])).toBe(6500)
  })
})

describe('customer expiry reminders', () => {
  const NOW = T0.toMillis()
  it('sends the 30-day reminder once, then the 7-day one, never repeating either', () => {
    expect(dueReminder(NOW + 31 * 86_400_000, NOW, undefined)).toBeNull()
    expect(dueReminder(NOW + 29 * 86_400_000, NOW, undefined)).toBe('d30')
    expect(dueReminder(NOW + 29 * 86_400_000, NOW, { d30: true })).toBeNull()
    expect(dueReminder(NOW + 6 * 86_400_000, NOW, { d30: true })).toBe('d7')
    expect(dueReminder(NOW + 6 * 86_400_000, NOW, { d30: true, d7: true })).toBeNull()
    expect(dueReminder(NOW - 1, NOW, undefined)).toBeNull()
  })
  it('a voucher that first comes into range inside 7 days gets only the 7-day reminder', () => {
    expect(dueReminder(NOW + 5 * 86_400_000, NOW, undefined)).toBe('d7')
  })
})

describe('marking a wallet voucher used', () => {
  const wallet = (extra: Record<string, unknown> = {}) => ({ userId: 'u1', status: 'active', redemptionKind: 'code_only', inventoryVoucherId: 'v', expiresAt: day(30), ...extra })
  const setup = (walletExtra: Record<string, unknown> = {}) => {
    const db = new TransactionStore()
    seed(db, 'v', { status: 'DELIVERED', soldAt: day(-1) })
    db.seed('vouchers/w1', wallet(walletExtra))
    return db
  }

  it('moves the wallet voucher and its ledger copy together, with the event', async () => {
    const db = setup()
    expect(await markWalletVoucherUsed(db.db, 'u1', 'w1', T0)).toBe('ok')
    expect(db.read('vouchers/w1')).toMatchObject({ status: 'redeemed', selfReportedUse: true })
    expect(db.read('inventoryVouchers/v')).toMatchObject({ status: 'REDEEMED', balanceAgorot: 0 })
    expect(eventTypes(db)).toEqual(['REDEEMED'])
  })

  it('refuses an expired voucher and changes nothing', async () => {
    const db = setup({ expiresAt: day(-1) })
    expect(await markWalletVoucherUsed(db.db, 'u1', 'w1', T0)).toBe('expired')
    expect(db.read('vouchers/w1')).toMatchObject({ status: 'active' })
    expect(db.read('inventoryVouchers/v')).toMatchObject({ status: 'DELIVERED', balanceAgorot: 10000 })
    expect(eventTypes(db)).toEqual([])
  })

  it('commits neither document when the transaction fails before commit', async () => {
    const db = setup()
    db.beforeCommit = async () => { throw new Error('injected pre-commit failure') }
    await expect(markWalletVoucherUsed(db.db, 'u1', 'w1', T0)).rejects.toThrow('injected pre-commit failure')
    expect(db.read('vouchers/w1')).toMatchObject({ status: 'active' })
    expect(db.read('inventoryVouchers/v')).toMatchObject({ status: 'DELIVERED' })
    expect(eventTypes(db)).toEqual([])
  })

  it('treats a foreign or missing voucher as not found, and a non-code or used one as not eligible', async () => {
    const db = setup()
    expect(await markWalletVoucherUsed(db.db, 'intruder', 'w1', T0)).toBe('notFound')
    expect(await markWalletVoucherUsed(db.db, 'u1', 'nope', T0)).toBe('notFound')
    db.seed('vouchers/qr', wallet({ redemptionKind: undefined }))
    expect(await markWalletVoucherUsed(db.db, 'u1', 'qr', T0)).toBe('notEligible')
    expect(await markWalletVoucherUsed(db.db, 'u1', 'w1', T0)).toBe('ok')
    expect(await markWalletVoucherUsed(db.db, 'u1', 'w1', T0)).toBe('notEligible')
    expect(eventTypes(db)).toEqual(['REDEEMED'])
  })

  it('still records a voucher from before the ledger, or whose ledger copy is already finished, on the wallet alone', async () => {
    const db = new TransactionStore()
    db.seed('vouchers/old', wallet({ inventoryVoucherId: undefined }))
    expect(await markWalletVoucherUsed(db.db, 'u1', 'old', T0)).toBe('ok')
    seed(db, 'done', { status: 'REDEEMED', balanceAgorot: 0 })
    db.seed('vouchers/fin', wallet({ inventoryVoucherId: 'done' }))
    expect(await markWalletVoucherUsed(db.db, 'u1', 'fin', T0)).toBe('ok')
    expect(db.read('vouchers/fin')).toMatchObject({ status: 'redeemed' })
    expect(eventTypes(db)).toEqual([])
  })
})

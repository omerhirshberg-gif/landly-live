import { afterAll, beforeEach, expect, it, vi } from 'vitest'
import { Firestore, Timestamp } from 'firebase-admin/firestore'
import { markWalletVoucherUsed } from '@/lib/inventory/ledger/operations'

vi.mock('@/lib/firebase/config', () => ({ db: {}, auth: {} }))

// Hard stop, not skip: these tests must NEVER silently connect to production.
if (process.env.FIRESTORE_EMULATOR_HOST !== '127.0.0.1:8787') {
  throw new Error('Run npm run test:emulator; only the isolated loopback emulator is permitted.')
}
const db = new Firestore({ projectId: 'demo-landly-payments' })
const now = Timestamp.now()
const future = Timestamp.fromMillis(now.toMillis() + 86_400_000)
const past = Timestamp.fromMillis(now.toMillis() - 86_400_000)

async function reset() {
  const docs = (await Promise.all(['vouchers', 'inventoryVouchers', 'voucherEvents'].map((c) => db.collection(c).get()))).flatMap((s) => s.docs)
  const batch = db.batch()
  for (const d of docs) batch.delete(d.ref)
  await batch.commit()
}
const seed = (expiresAt: Timestamp) => Promise.all([
  db.doc('vouchers/w1').set({ userId: 'u1', status: 'active', redemptionKind: 'code_only', inventoryVoucherId: 'v', expiresAt }),
  db.doc('inventoryVouchers/v').set({ supplierId: 'raayonit', productId: 'p', status: 'DELIVERED', faceValueAgorot: 10000, balanceAgorot: 10000, expiresAt, reservedUntil: null, reservedForOrderId: null, soldAt: past }),
])

beforeEach(reset)
afterAll(async () => { await reset(); await db.terminate() })

it('redeems the wallet voucher and its ledger copy in one real transaction, once', async () => {
  await seed(future)
  const results = await Promise.all([1, 2, 3].map(() => markWalletVoucherUsed(db, 'u1', 'w1')))
  expect(results.filter((r) => r === 'ok')).toHaveLength(1)
  expect(results.filter((r) => r === 'notEligible')).toHaveLength(2)
  expect((await db.doc('vouchers/w1').get()).data()).toMatchObject({ status: 'redeemed', selfReportedUse: true })
  expect((await db.doc('inventoryVouchers/v').get()).data()).toMatchObject({ status: 'REDEEMED', balanceAgorot: 0 })
  expect((await db.collection('voucherEvents').get()).size).toBe(1)
})

it('refuses an expired voucher and leaves both documents untouched', async () => {
  await seed(past)
  expect(await markWalletVoucherUsed(db, 'u1', 'w1')).toBe('expired')
  expect((await db.doc('vouchers/w1').get()).data()).toMatchObject({ status: 'active' })
  expect((await db.doc('inventoryVouchers/v').get()).data()).toMatchObject({ status: 'DELIVERED' })
  expect((await db.collection('voucherEvents').get()).size).toBe(0)
})

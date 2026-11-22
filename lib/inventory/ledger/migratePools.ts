import 'server-only'
import { Timestamp, type Firestore } from 'firebase-admin/firestore'
import { decryptField } from '@/lib/crypto/fieldCipher'
import { PaymentError, isDocumentId } from '@/lib/payments/paymentValidation'
import { encryptVoucherCode, hashCode } from './codes'
import { carriedVoucherData, ledgerCarry } from './transitions'
import { EVENTS_COLLECTION, PRODUCTS_COLLECTION, VOUCHERS_COLLECTION, type EventSource, type InventoryStatus, type VoucherEventType } from './types'
import { POOL_COLLECTION, poolItemId } from '../types'

// Backfills a legacy couponPools stock into the ledger. The product keeps the pool's id, so offer variants, orders and
// vouchers keep pointing at the same string. Runbook (per pool, ideally in a quiet window):
//   1. start      pool.migrating = true (checkout refuses new orders for it); the product is created INACTIVE, so sales still
//                 follow the old path until it is switched on
//   2. copy       items in pages of PAGE (call again with the returned cursor until `done`): each code is decrypted with its old
//                 AAD and re-encrypted for its new document; the doc id is the code's hash, so a repeat is skipped
//   3. activate   product.active = true: from here checkout and settlement use the ledger
//   4. catch-up   run `copy` once more from cursor 0: items allocated since step 2 are marked DELIVERED in the ledger
// Dry runs read and count; they write nothing.

const PAGE = 100

export interface MigrateResult { poolId: string; copied: number; skipped: number; caughtUp: number; cursor: number; done: boolean; dry: boolean }

const mapStatus = (itemStatus: string, walletStatus: string | undefined): Extract<InventoryStatus, 'IN_STOCK' | 'DELIVERED' | 'REDEEMED' | 'EXPIRED'> => {
  if (itemStatus === 'available') return 'IN_STOCK'
  if (itemStatus === 'expired') return 'EXPIRED'
  return walletStatus === 'redeemed' ? 'REDEEMED' : 'DELIVERED'
}

export async function startPoolMigration(db: Firestore, poolId: string, dry: boolean): Promise<{ productCreated: boolean }> {
  if (!isDocumentId(poolId)) throw new PaymentError('Invalid pool.', 400)
  const poolRef = db.collection(POOL_COLLECTION).doc(poolId)
  const pool = (await poolRef.get()).data()
  if (!pool || pool.kind !== 'shared' || !Number.isInteger(pool.faceValueAgorot)) throw new PaymentError('Only a shared Raayonit stock with a face value can be migrated.', 400)
  const productRef = db.collection(PRODUCTS_COLLECTION).doc(poolId)
  if ((await productRef.get()).exists) return { productCreated: false }
  if (!dry) {
    const now = Timestamp.now()
    await poolRef.update({ migrating: true })
    await productRef.create({
      supplierId: 'raayonit', title: String(pool.title ?? ''), businessId: null, faceValueAgorot: pool.faceValueAgorot, salePriceAgorot: pool.priceAgorot ?? pool.faceValueAgorot,
      costPriceAgorot: pool.unitCost ?? 0, validityDays: null, issueMode: 'stock', lowStockThreshold: Number.isInteger(pool.warningThreshold) ? pool.warningThreshold : 10,
      active: false, migratedFromPool: true, createdAt: now, updatedAt: now,
    })
    await db.collection('suppliers').doc('raayonit').set({ name: 'Raayonit', active: true }, { merge: true })
  }
  return { productCreated: true }
}

export async function copyPoolItems(db: Firestore, poolId: string, cursor: number, dry: boolean): Promise<MigrateResult> {
  const poolRef = db.collection(POOL_COLLECTION).doc(poolId)
  const pool = (await poolRef.get()).data()
  if (!pool) throw new PaymentError('Pool not found.', 404)
  const items = await poolRef.collection('items').where('seq', '>', cursor).orderBy('seq').limit(PAGE).get()
  const result: MigrateResult = { poolId, copied: 0, skipped: 0, caughtUp: 0, cursor, done: items.empty || items.size < PAGE, dry }
  const now = Timestamp.now()
  for (const doc of items.docs) {
    const item = doc.data()
    result.cursor = item.seq
    const code = decryptField('POOL_CODES_KEY', item.codeCipher, `${poolId}/${poolItemId(item.seq)}`)
    const id = typeof item.codeHash === 'string' && item.codeHash ? item.codeHash : hashCode(code)
    const ref = db.collection(VOUCHERS_COLLECTION).doc(id)
    const existing = await ref.get()
    let walletStatus: string | undefined
    if (item.status === 'allocated' && typeof item.orderId === 'string') walletStatus = (await db.collection('vouchers').doc(item.orderId).get()).data()?.status
    const status = mapStatus(String(item.status), walletStatus)
    if (existing.exists) {
      // Catch-up: an item that was IN_STOCK when copied and has been sold since.
      if (existing.data()!.status === 'IN_STOCK' && status !== 'IN_STOCK') {
        result.caughtUp++
        if (!dry) await carryOver(db, ref.id, status, item.orderId ?? null, item.allocatedAt ?? now, now, true)
      } else result.skipped++
      continue
    }
    result.copied++
    if (dry) continue
    const data = carriedVoucherData({
      productId: poolId, supplierId: 'raayonit', codeEncrypted: encryptVoucherCode(code, id), codeHash: id, faceValueAgorot: pool.faceValueAgorot, status,
      soldAt: item.allocatedAt ?? null, orderItemId: item.orderId ?? null, expiresAt: item.expiresAt ?? null, importBatchId: 'legacy-pool',
    }, now)
    await db.runTransaction(async (tx) => {
      if ((await tx.get(ref)).exists) return
      tx.create(ref, data)
      for (const e of eventsFor(id, status, item.orderId ?? null, item.allocatedAt ?? now, now, pool.faceValueAgorot)) tx.create(db.collection(EVENTS_COLLECTION).doc(), e)
    })
  }
  return result
}

const eventsFor = (voucherId: string, status: string, orderId: string | null, soldAt: Timestamp, now: Timestamp, face: number) => {
  const make = (type: VoucherEventType, from: InventoryStatus | null, to: InventoryStatus, at: Timestamp, amountAgorot = 0) => ({
    voucherId, type, fromStatus: from, toStatus: to, amountAgorot, businessId: null, source: 'system' as EventSource, externalEventId: null, occurredAt: at, meta: { migrated: true, ...(orderId ? { orderId } : {}) },
  })
  const out = [make('IMPORTED', 'STAGED', 'IN_STOCK', now)]
  if (status === 'DELIVERED' || status === 'REDEEMED') { out.push(make('SOLD', 'RESERVED', 'SOLD', soldAt, face), make('DELIVERED', 'SOLD', 'DELIVERED', soldAt)) }
  if (status === 'REDEEMED') out.push(make('REDEEMED', 'DELIVERED', 'REDEEMED', now, face))
  if (status === 'EXPIRED') out.push(make('EXPIRED', 'IN_STOCK', 'EXPIRED', now))
  return out
}

async function carryOver(db: Firestore, voucherId: string, status: InventoryStatus, orderId: string | null, soldAt: Timestamp, now: Timestamp, _catchUp: boolean) {
  const ref = db.collection(VOUCHERS_COLLECTION).doc(voucherId)
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref)
    if (!snap.exists || snap.data()!.status !== 'IN_STOCK') return
    const face = snap.data()!.faceValueAgorot as number
    tx.update(ref, ledgerCarry(status, orderId, soldAt, now, face))
    for (const e of eventsFor(voucherId, status, orderId, soldAt, now, face).slice(1)) tx.create(db.collection(EVENTS_COLLECTION).doc(), e)
  })
}

export async function activateProduct(db: Firestore, poolId: string): Promise<void> {
  await db.collection(PRODUCTS_COLLECTION).doc(poolId).update({ active: true, updatedAt: Timestamp.now() })
  await db.collection(POOL_COLLECTION).doc(poolId).update({ migrating: false, migratedToLedger: true })
}

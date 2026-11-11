import 'server-only'
import { createHash } from 'node:crypto'
import { Timestamp, type Firestore } from 'firebase-admin/firestore'
import { encryptField } from '@/lib/crypto/fieldCipher'
import { PaymentError, isDocumentId } from '@/lib/payments/paymentValidation'
import { POOL_COLLECTION, poolItemId } from './types'

export const MAX_CODE_LENGTH = 200
// One transaction writes an item and a dedupe marker per code: 2 x 200 stays well under Firestore's 500-write limit.
export const CODES_PER_TRANSACTION = 200

export interface NewPoolInput {
  offerId: string
  warningThreshold: number
  unitCostAgorot: number
  retailPriceAgorot: number
}

const sha256 = (value: string) => createHash('sha256').update(value).digest('hex')

/** One pool per offer; its document id is the offer's id. Links the offer to it. */
export async function createPool(db: Firestore, input: NewPoolInput) {
  const { offerId } = input
  if (!isDocumentId(offerId)) throw new PaymentError('Invalid offerId.', 400)
  if (!Number.isInteger(input.warningThreshold) || input.warningThreshold < 0) throw new PaymentError('Warning threshold must be a whole number, 0 or more.', 400)
  for (const value of [input.unitCostAgorot, input.retailPriceAgorot]) {
    if (!Number.isInteger(value) || value < 0) throw new PaymentError('Prices must be whole agorot.', 400)
  }
  const poolRef = db.collection(POOL_COLLECTION).doc(offerId)
  const offerRef = db.collection('offers').doc(offerId)
  await db.runTransaction(async (tx) => {
    const [pool, offer] = await Promise.all([tx.get(poolRef), tx.get(offerRef)])
    if (!offer.exists) throw new PaymentError('Offer not found.', 404)
    if (pool.exists) throw new PaymentError('This offer already has a pool.')
    const now = Timestamp.now()
    tx.create(poolRef, {
      offerId, provider: 'multipass', totalPurchased: 0, allocatedCount: 0, remainingCount: 0,
      warningThreshold: input.warningThreshold, lowStock: true, unitCost: input.unitCostAgorot,
      retailPrice: input.retailPriceAgorot, status: 'depleted', nextSeq: 1, lastSeq: 0, createdAt: now, updatedAt: now,
    })
    // Sales now draw from the pool; claimed vs capacity mirrors the pool's size.
    tx.update(offerRef, { fulfillmentType: 'multipass_pool', poolId: offerId, totalQuantity: null })
  })
}

export interface AddCodesResult { added: number; duplicates: number; invalid: number }

/** One supplier row: the code or barcode, its own expiry, and an optional serial or PIN. */
export interface PoolEntry { code: string; expiresAt?: Date | null; pin?: string | null }

/** Encrypts and appends codes. Duplicates (by hash) and blank or oversize lines are skipped and counted. */
export async function addPoolCodes(db: Firestore, poolId: string, rawCodes: readonly string[], expiresAt: Date | null = null): Promise<AddCodesResult> {
  return addPoolEntries(db, poolId, rawCodes.map((code) => ({ code, expiresAt })))
}

/** Same as addPoolCodes, for rows that carry their own expiry and PIN (a supplier spreadsheet). */
export async function addPoolEntries(db: Firestore, poolId: string, rawEntries: readonly PoolEntry[]): Promise<AddCodesResult> {
  if (!isDocumentId(poolId)) throw new PaymentError('Invalid pool.', 400)
  const result: AddCodesResult = { added: 0, duplicates: 0, invalid: 0 }
  const seen = new Set<string>()
  const entries: { code: string; expiresAt: Date | null; pin: string | null }[] = []
  for (const raw of rawEntries) {
    const code = raw.code.trim()
    const pin = raw.pin?.trim() || null
    if (!code || code.length > MAX_CODE_LENGTH || (pin && pin.length > MAX_CODE_LENGTH)) { result.invalid++; continue }
    if (seen.has(code)) { result.duplicates++; continue }
    seen.add(code)
    entries.push({ code, expiresAt: raw.expiresAt ?? null, pin })
  }
  const poolRef = db.collection(POOL_COLLECTION).doc(poolId)
  for (let start = 0; start < entries.length; start += CODES_PER_TRANSACTION) {
    const chunk = entries.slice(start, start + CODES_PER_TRANSACTION)
    const out = await db.runTransaction(async (tx) => {
      const hashRefs = chunk.map((entry) => poolRef.collection('codeHashes').doc(sha256(entry.code)))
      const [poolSnap, ...hashSnaps] = await Promise.all([tx.get(poolRef), ...hashRefs.map((ref) => tx.get(ref))])
      const pool = poolSnap.data()
      if (!poolSnap.exists || !pool) throw new PaymentError('Pool not found.', 404)
      if (pool.status === 'archived') throw new PaymentError('Pool is archived.')
      const now = Timestamp.now()
      let seq: number = pool.lastSeq
      let added = 0
      chunk.forEach((entry, i) => {
        if (hashSnaps[i]!.exists) return
        seq++
        added++
        const itemId = poolItemId(seq)
        tx.create(poolRef.collection('items').doc(itemId), {
          seq, codeCipher: encryptField('POOL_CODES_KEY', entry.code, `${poolId}/${itemId}`), codeHash: sha256(entry.code),
          ...(entry.pin ? { pinCipher: encryptField('POOL_CODES_KEY', entry.pin, `${poolId}/${itemId}/pin`) } : {}),
          status: 'available', orderId: null, userId: null, allocatedAt: null,
          expiresAt: entry.expiresAt ? Timestamp.fromDate(entry.expiresAt) : null,
        })
        tx.create(hashRefs[i]!, { seq, at: now })
      })
      if (added > 0) {
        const remaining = pool.remainingCount + added
        tx.update(poolRef, {
          lastSeq: seq, totalPurchased: pool.totalPurchased + added, remainingCount: remaining,
          lowStock: remaining <= pool.warningThreshold, status: 'active', updatedAt: now,
        })
      }
      return { added, duplicates: chunk.length - added }
    })
    result.added += out.added
    result.duplicates += out.duplicates
  }
  return result
}

/** Removes a pool with its items and dedupe markers (compensation when an offer's first codes can't be stored). The offer is the caller's to fix. */
export async function deletePoolCascade(db: Firestore, poolId: string): Promise<void> {
  if (!isDocumentId(poolId)) throw new PaymentError('Invalid pool.', 400)
  const poolRef = db.collection(POOL_COLLECTION).doc(poolId)
  for (const name of ['items', 'codeHashes']) {
    for (;;) {
      const snap = await poolRef.collection(name).limit(400).get()
      if (snap.empty) break
      const batch = db.batch()
      snap.docs.forEach((doc) => batch.delete(doc.ref))
      await batch.commit()
    }
  }
  await poolRef.delete()
}

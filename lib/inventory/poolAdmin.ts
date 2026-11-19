import 'server-only'
import { createHash } from 'node:crypto'
import { Timestamp, type Firestore } from 'firebase-admin/firestore'
import { encryptField } from '@/lib/crypto/fieldCipher'
import { PaymentError, isDocumentId } from '@/lib/payments/paymentValidation'
import { POOL_COLLECTION, poolItemId } from './types'

export const MAX_CODE_LENGTH = 200
// One transaction writes an item and a dedupe marker per code: 2 x 200 stays well under Firestore's 500-write limit.
export const CODES_PER_TRANSACTION = 200

const sha256 = (value: string) => createHash('sha256').update(value).digest('hex')

export const MAX_FACE_VALUE_AGOROT = 100_000_00

export interface NewSharedPoolInput {
  /** What admins see, e.g. "רעיונית - תו על 100 ₪". */
  title: string
  faceValueAgorot: number
  priceAgorot: number
  warningThreshold: number
  /** The wholesale cost per voucher; 0 when unknown. */
  unitCostAgorot: number
}

const wholeAgorot = (value: unknown, min: number): value is number => Number.isInteger(value) && (value as number) >= min

/** A stock of Raayonit vouchers of one face value, shared by every offer linked to it. Returns its id. */
export async function createSharedPool(db: Firestore, input: NewSharedPoolInput): Promise<string> {
  const title = input.title.trim()
  if (!title || title.length > 120) throw new PaymentError('Give the stock a name of up to 120 characters.', 400)
  if (!wholeAgorot(input.faceValueAgorot, 1) || input.faceValueAgorot > MAX_FACE_VALUE_AGOROT) throw new PaymentError('Voucher value must be a positive whole amount.', 400)
  if (!wholeAgorot(input.priceAgorot, 1) || input.priceAgorot > input.faceValueAgorot) throw new PaymentError('The sale price must be positive and no more than the voucher value.', 400)
  if (!wholeAgorot(input.warningThreshold, 0)) throw new PaymentError('Warning threshold must be a whole number, 0 or more.', 400)
  if (!wholeAgorot(input.unitCostAgorot, 0)) throw new PaymentError('Cost must be a whole number of agorot, 0 or more.', 400)
  // One stock per face value: the Excel sheet's amount column picks it, and offers can't pick the wrong one.
  const existing = await db.collection(POOL_COLLECTION).where('kind', '==', 'shared').where('faceValueAgorot', '==', input.faceValueAgorot).limit(1).get()
  if (!existing.empty) throw new PaymentError('A stock for this voucher value already exists. Add codes to it instead.')
  const ref = db.collection(POOL_COLLECTION).doc()
  const now = Timestamp.now()
  await ref.set({
    kind: 'shared', provider: 'raayonit', title, faceValueAgorot: input.faceValueAgorot, priceAgorot: input.priceAgorot,
    totalPurchased: 0, allocatedCount: 0, remainingCount: 0, warningThreshold: input.warningThreshold, lowStock: true,
    unitCost: input.unitCostAgorot, retailPrice: input.faceValueAgorot, status: 'depleted', nextSeq: 1, lastSeq: 0, createdAt: now, updatedAt: now,
  })
  return ref.id
}

/** A shared stock's sale terms, and a check that an offer sells exactly what the stock holds. Null when there is no such shared stock. */
export async function readSharedPoolTerms(db: Firestore, poolId: unknown): Promise<{ faceValueAgorot: number; priceAgorot: number; title: string } | null> {
  if (!isDocumentId(poolId)) return null
  const snap = await db.collection(POOL_COLLECTION).doc(poolId).get()
  const data = snap.data()
  if (!data || data.kind !== 'shared' || data.status === 'archived' || !Number.isInteger(data.faceValueAgorot) || !Number.isInteger(data.priceAgorot)) return null
  return { faceValueAgorot: data.faceValueAgorot, priceAgorot: data.priceAgorot, title: typeof data.title === 'string' ? data.title : '' }
}

/** An error message when the offer's prices differ from the stock's (a 100 voucher can't be sold as a 150), else null. */
export function poolPriceProblem(terms: { faceValueAgorot: number; priceAgorot: number }, originalPrice: unknown, offerPrice: unknown): string | null {
  const ok = Math.round(Number(originalPrice) * 100) === terms.faceValueAgorot && Math.round(Number(offerPrice) * 100) === terms.priceAgorot
  return ok ? null : `Prices must match the voucher stock: worth ₪${terms.faceValueAgorot / 100}, sold for ₪${terms.priceAgorot / 100}.`
}

/** Points an offer at a shared stock and gives it the sale terms the stock dictates. Throws when the stock is unknown. */
export async function linkOfferToPool(db: Firestore, offerId: string, poolId: string): Promise<void> {
  if (!isDocumentId(offerId) || !isDocumentId(poolId)) throw new PaymentError('Invalid offer or stock.', 400)
  const poolRef = db.collection(POOL_COLLECTION).doc(poolId)
  const offerRef = db.collection('offers').doc(offerId)
  await db.runTransaction(async (tx) => {
    const [pool, offer] = await Promise.all([tx.get(poolRef), tx.get(offerRef)])
    if (!pool.exists || pool.data()?.kind !== 'shared') throw new PaymentError('Voucher stock not found.', 404)
    if (!offer.exists) throw new PaymentError('Offer not found.', 404)
    tx.update(offerRef, { fulfillmentType: 'raayonit_pool', poolId, totalQuantity: null })
  })
}

export interface AddCodesResult { added: number; duplicates: number; invalid: number }

/** One supplier row: the voucher code (it has no QR code and no expiry of its own: it lasts 5 years from purchase). */
export interface PoolEntry { code: string }

/** Encrypts and appends codes. Duplicates (by hash) and blank or oversize lines are skipped and counted. */
export async function addPoolCodes(db: Firestore, poolId: string, rawCodes: readonly string[]): Promise<AddCodesResult> {
  return addPoolEntries(db, poolId, rawCodes.map((code) => ({ code })))
}

/** Same as addPoolCodes, for the rows of a supplier spreadsheet. */
export async function addPoolEntries(db: Firestore, poolId: string, rawEntries: readonly PoolEntry[]): Promise<AddCodesResult> {
  if (!isDocumentId(poolId)) throw new PaymentError('Invalid pool.', 400)
  const result: AddCodesResult = { added: 0, duplicates: 0, invalid: 0 }
  const seen = new Set<string>()
  const entries: { code: string }[] = []
  for (const raw of rawEntries) {
    const code = raw.code.trim()
    if (!code || code.length > MAX_CODE_LENGTH) { result.invalid++; continue }
    if (seen.has(code)) { result.duplicates++; continue }
    seen.add(code)
    entries.push({ code })
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
          status: 'available', orderId: null, userId: null, allocatedAt: null,
          expiresAt: null,
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

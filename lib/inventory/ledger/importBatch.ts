import 'server-only'
import { createHash } from 'node:crypto'
import { Timestamp, type Firestore } from 'firebase-admin/firestore'
import { encryptVoucherCode, hashCode, codeTail } from './codes'
import { commitPlan, planTransition, stagedVoucherData, TransitionError, type VoucherState } from './transitions'
import { BATCHES_COLLECTION, PRODUCTS_COLLECTION, VOUCHERS_COLLECTION, type RejectedRow, type SupplierId } from './types'
import { MAX_CODE_CHARS, parseAmount } from '../parseCodeSheet'
import { PaymentError } from '@/lib/payments/paymentValidation'

// Raayonit's two-column sheet (face value + code) becomes a pending batch: validated, the valid codes staged (STAGED, encrypted),
// the rejected rows kept ON the batch so the report can be downloaded again. Nothing is sellable until `approveBatch`.

export const MAX_ROWS_PER_BATCH = 2000
const STAGE_CHUNK = 150
const APPROVE_CHUNK = 100

export interface RawRow { code: unknown; amount: unknown }

export interface StageInput {
  supplierId: SupplierId
  fileName: string
  rows: readonly RawRow[]
  invoiceTotalExpectedAgorot: number
  expiresAt?: Date | null
  importedBy: string
}

export interface ValidatedRow { row: number; code: string; amountAgorot: number; productId: string }

export interface ValidationResult {
  valid: ValidatedRow[]
  rejected: RejectedRow[]
  /** Σ face value of the valid rows. */
  actualTotalAgorot: number
}

/** A stable hash of the file's content (order-independent), the duplicate-file guard's key. */
export function contentHash(rows: readonly RawRow[]): string {
  const lines = rows.map((r) => `${String(r.code ?? '').trim()}|${parseAmount(r.amount) ?? ''}`).sort()
  return createHash('sha256').update(lines.join('\n')).digest('hex')
}

/**
 * Pure per-row validation: required columns, a valid face value that has a product, no duplicate inside the file.
 * Duplicates against stock are checked afterwards (they need Firestore). `productsByValue` maps a face value (agorot) to its product id.
 */
export function validateRows(rows: readonly RawRow[], productsByValue: ReadonlyMap<number, string>): ValidationResult {
  const valid: ValidatedRow[] = []
  const rejected: RejectedRow[] = []
  const seen = new Set<string>()
  rows.forEach((raw, i) => {
    const row = i + 1
    const code = typeof raw.code === 'string' ? raw.code.trim() : raw.code == null ? '' : String(raw.code).trim()
    const amount = parseAmount(raw.amount)
    const amountAgorot = amount === null ? null : amount * 100
    if (!code) return void rejected.push({ row, reason: 'empty', codeTail: '', amountAgorot })
    if (code.length > MAX_CODE_CHARS) return void rejected.push({ row, reason: 'too_long', codeTail: codeTail(code), amountAgorot })
    if (amountAgorot === null) return void rejected.push({ row, reason: 'bad_amount', codeTail: codeTail(code), amountAgorot })
    const productId = productsByValue.get(amountAgorot)
    if (!productId) return void rejected.push({ row, reason: 'no_product', codeTail: codeTail(code), amountAgorot })
    if (seen.has(code)) return void rejected.push({ row, reason: 'duplicate_in_file', codeTail: codeTail(code), amountAgorot })
    seen.add(code)
    valid.push({ row, code, amountAgorot, productId })
  })
  return { valid, rejected, actualTotalAgorot: valid.reduce((sum, r) => sum + r.amountAgorot, 0) }
}

export const batchIdFor = (supplierId: SupplierId, fileHash: string) => `${supplierId}_${fileHash.slice(0, 40)}`

async function productsByValue(db: Firestore, supplierId: SupplierId): Promise<Map<number, string>> {
  const snap = await db.collection(PRODUCTS_COLLECTION).where('supplierId', '==', supplierId).where('active', '==', true).get()
  const map = new Map<number, string>()
  for (const d of snap.docs) { const v = d.data().faceValueAgorot; if (Number.isInteger(v) && !map.has(v)) map.set(v, d.id) }
  return map
}

export interface StageResult { batchId: string; rowsTotal: number; rowsOk: number; rowsRejected: number; invoiceTotalExpectedAgorot: number; invoiceTotalActualAgorot: number; totalsMatch: boolean }

/** Stages a batch. Throws PaymentError for a repeated file or a bad request; otherwise returns the counts (and rejected rows are on the batch). */
export async function stageBatch(db: Firestore, input: StageInput): Promise<StageResult> {
  if (input.rows.length === 0) throw new PaymentError('The file has no rows.', 400)
  if (input.rows.length > MAX_ROWS_PER_BATCH) throw new PaymentError(`At most ${MAX_ROWS_PER_BATCH} rows per import.`, 400)
  if (!Number.isInteger(input.invoiceTotalExpectedAgorot) || input.invoiceTotalExpectedAgorot < 0) throw new PaymentError('Enter the invoice total.', 400)
  const fileHash = contentHash(input.rows)
  const batchId = batchIdFor(input.supplierId, fileHash)
  const batchRef = db.collection(BATCHES_COLLECTION).doc(batchId)
  if ((await batchRef.get()).exists) throw new PaymentError('This file was already imported.', 409)

  const validation = validateRows(input.rows, await productsByValue(db, input.supplierId))
  const rejected = [...validation.rejected]
  // Against stock: the doc id is the code hash, so one getAll per chunk finds every repeat (plus the legacy pool's hash markers).
  const fresh: ValidatedRow[] = []
  for (let i = 0; i < validation.valid.length; i += 300) {
    const chunk = validation.valid.slice(i, i + 300)
    const refs = chunk.map((r) => db.collection(VOUCHERS_COLLECTION).doc(hashCode(r.code)))
    const legacy = chunk.map((r) => db.collection('couponPools').doc(r.productId).collection('codeHashes').doc(hashCode(r.code)))
    const snaps = await db.getAll(...refs, ...legacy)
    chunk.forEach((r, k) => {
      if (snaps[k]!.exists || snaps[chunk.length + k]!.exists) rejected.push({ row: r.row, reason: 'duplicate_in_stock', codeTail: codeTail(r.code), amountAgorot: r.amountAgorot })
      else fresh.push(r)
    })
  }
  rejected.sort((a, b) => a.row - b.row)
  const actual = fresh.reduce((sum, r) => sum + r.amountAgorot, 0)
  const now = Timestamp.now()
  const expiresAt = input.expiresAt ? Timestamp.fromDate(input.expiresAt) : null
  try {
    await batchRef.create({
      supplierId: input.supplierId, fileName: input.fileName.slice(0, 200), fileHash, rowsTotal: input.rows.length, rowsOk: fresh.length, rowsRejected: rejected.length,
      rejectedRows: rejected, invoiceTotalExpectedAgorot: input.invoiceTotalExpectedAgorot, invoiceTotalActualAgorot: actual, expiresAt,
      status: 'pending_approval', stagingComplete: false, importedAt: now, importedBy: input.importedBy, approvedAt: null, approvedBy: null, approvedCount: 0,
      totalsOverride: null,
    })
  } catch {
    throw new PaymentError('This file was already imported.', 409)
  }
  for (let i = 0; i < fresh.length; i += STAGE_CHUNK) {
    const chunk = fresh.slice(i, i + STAGE_CHUNK)
    await db.runTransaction(async (tx) => {
      const refs = chunk.map((r) => db.collection(VOUCHERS_COLLECTION).doc(hashCode(r.code)))
      const snaps = await Promise.all(refs.map((ref) => tx.get(ref)))
      chunk.forEach((r, k) => {
        // Lost a race with another import of the same code: the code exists once, so this row is simply not staged.
        if (snaps[k]!.exists) return
        const id = refs[k]!.id
        tx.create(refs[k]!, stagedVoucherData({ productId: r.productId, supplierId: input.supplierId, codeEncrypted: encryptVoucherCode(r.code, id), codeHash: id, faceValueAgorot: r.amountAgorot, importBatchId: batchId, expiresAt }, now))
      })
    })
  }
  await batchRef.update({ stagingComplete: true })
  return { batchId, rowsTotal: input.rows.length, rowsOk: fresh.length, rowsRejected: rejected.length, invoiceTotalExpectedAgorot: input.invoiceTotalExpectedAgorot, invoiceTotalActualAgorot: actual, totalsMatch: actual === input.invoiceTotalExpectedAgorot }
}

export interface ApproveOptions { approvedBy: string; /** Needed when the file total differs from the invoice. */ mismatchReason?: string; now?: Timestamp }

/**
 * Approves a pending batch: every STAGED code becomes IN_STOCK with an IMPORTED event, in chunks that can resume after a failure.
 * A total that differs from the invoice blocks it unless the admin gives a reason (stored on the batch).
 */
export async function approveBatch(db: Firestore, batchId: string, opts: ApproveOptions): Promise<{ approved: number; complete: boolean }> {
  const batchRef = db.collection(BATCHES_COLLECTION).doc(batchId)
  const snap = await batchRef.get()
  if (!snap.exists) throw new PaymentError('Import batch not found.', 404)
  const batch = snap.data()!
  if (batch.status === 'approved') throw new PaymentError('This batch is already approved.', 409)
  if (batch.stagingComplete !== true) throw new PaymentError('This batch did not finish staging; remove it and import again.', 409)
  const mismatch = batch.invoiceTotalActualAgorot !== batch.invoiceTotalExpectedAgorot
  if (mismatch && !opts.mismatchReason?.trim()) throw new PaymentError('The file total differs from the invoice total. Give a reason to approve anyway.', 422)
  if (mismatch && batch.totalsOverride === null) await batchRef.update({ totalsOverride: { reason: opts.mismatchReason!.trim(), by: opts.approvedBy } })
  const now = opts.now ?? Timestamp.now()
  let approved = 0
  for (;;) {
    const staged = await db.collection(VOUCHERS_COLLECTION).where('importBatchId', '==', batchId).where('status', '==', 'STAGED').limit(APPROVE_CHUNK).get()
    if (staged.empty) break
    const n = await db.runTransaction(async (tx) => {
      const snaps = await Promise.all(staged.docs.map((d) => tx.get(d.ref)))
      let count = 0
      for (const s of snaps) {
        const current = s.data() as VoucherState | undefined
        if (!current || current.status !== 'STAGED') continue
        commitPlan(db, tx, s.ref, current.supplierId, planTransition(current, 'IN_STOCK', { now, source: 'system', actor: opts.approvedBy, meta: { batchId } }), now)
        count++
      }
      return count
    })
    approved += n
    if (n === 0) break
  }
  const remaining = await db.collection(VOUCHERS_COLLECTION).where('importBatchId', '==', batchId).where('status', '==', 'STAGED').limit(1).get()
  const total = (await db.collection(VOUCHERS_COLLECTION).where('importBatchId', '==', batchId).where('status', '==', 'IN_STOCK').count?.().get())?.data().count
  const complete = remaining.empty
  await batchRef.update({ approvedCount: total ?? batch.approvedCount + approved, ...(complete ? { status: 'approved', approvedAt: now, approvedBy: opts.approvedBy } : {}) })
  return { approved, complete }
}

/** Rejects a pending batch: its STAGED codes become VOID (with the reason and actor). */
export async function rejectBatch(db: Firestore, batchId: string, opts: { reason: string; actor: string; now?: Timestamp }): Promise<number> {
  if (!opts.reason.trim()) throw new PaymentError('Give a reason.', 400)
  const batchRef = db.collection(BATCHES_COLLECTION).doc(batchId)
  const snap = await batchRef.get()
  if (!snap.exists) throw new PaymentError('Import batch not found.', 404)
  if (snap.data()!.status === 'approved') throw new PaymentError('An approved batch cannot be rejected; void codes one by one.', 409)
  const now = opts.now ?? Timestamp.now()
  let voided = 0
  for (;;) {
    const staged = await db.collection(VOUCHERS_COLLECTION).where('importBatchId', '==', batchId).where('status', '==', 'STAGED').limit(APPROVE_CHUNK).get()
    if (staged.empty) break
    voided += await db.runTransaction(async (tx) => {
      const snaps = await Promise.all(staged.docs.map((d) => tx.get(d.ref)))
      let count = 0
      for (const s of snaps) {
        const current = s.data() as VoucherState | undefined
        if (!current || current.status !== 'STAGED') continue
        commitPlan(db, tx, s.ref, current.supplierId, planTransition(current, 'VOID', { now, reason: opts.reason, actor: opts.actor, meta: { batchId } }), now)
        count++
      }
      return count
    })
  }
  await batchRef.update({ status: 'rejected', rejectedAt: now })
  return voided
}

export { TransitionError }

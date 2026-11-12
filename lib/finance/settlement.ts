import 'server-only'
import { createHash } from 'node:crypto'
import { Timestamp, type DocumentSnapshot, type Firestore, type Transaction } from 'firebase-admin/firestore'
import { getAllById } from '@/lib/firebase/batching'
import { decryptField } from '@/lib/crypto/fieldCipher'
import { auditInTransaction } from '@/lib/admin/auditLog'
import { commissionAgorot, paymentTermsDays, parseFrozenTerms } from '@/lib/merchants/terms'
import { buildMasavFile, encodeWindows1255, masavConfig, masavFileName, type MasavConfig, type MasavPayment } from './masavGenerator'

// Monthly merchant settlement.
//
// What gets paid: vouchers with status 'redeemed', fulfillmentType
// 'direct_merchant' and no payoutBatchId, once the merchant's payment terms
// (frozen on the voucher at purchase) have run since redemption. The merchant
// receives the price paid minus Landly's commission, rounded per voucher in
// whole agorot so the file total always equals the sum of its lines.
//
// Money moves in two steps an admin confirms: a preview that writes nothing,
// then "lock and generate", which stamps payoutBatchId on each voucher (so none
// can be paid twice), stores the file, and records the batch.
export const PAYOUTS = 'payoutBatches'
const LOCK_CHUNK = 400

export class SettlementError extends Error {
  constructor(message: string, public readonly status = 409) { super(message) }
}

export type BlockReason = 'missing_terms' | 'missing_bank_details' | 'invalid_bank_details' | 'missing_amount' | 'nothing_due'

export interface SettlementLine {
  businessId: string
  businessName: string
  voucherIds: string[]
  grossAgorot: number
  commissionAgorot: number
  netAgorot: number
  /** Redeemed but not yet due under the merchant's terms. */
  notYetDue: number
  blocked: BlockReason | null
}

export interface SettlementPreview {
  valueDate: string
  lines: SettlementLine[]
  readyCount: number
  readyVouchers: number
  readyNetAgorot: number
}

export interface VoucherFacts {
  id: string
  businessId: string
  amountAgorot: unknown
  commissionRate: unknown
  paymentTerms: unknown
  redeemedAt: Timestamp | null
}

/** "2026-11-30" is due when redeemedAt + net days is on or before the end of that day (Israel time, UTC+3 at the latest). */
function dueBy(valueDate: string, redeemed: Timestamp, days: number): boolean {
  const endOfDay = Date.parse(`${valueDate}T23:59:59+03:00`)
  return redeemed.toMillis() + days * 86_400_000 <= endOfDay
}

/** Pure: which vouchers are due, grouped and totalled per merchant. `hasBank` says whether the merchant can be paid. */
export function planSettlement(
  valueDate: string, vouchers: readonly VoucherFacts[], names: ReadonlyMap<string, string>, hasBank: (businessId: string) => 'ok' | 'missing' | 'invalid',
): SettlementPreview {
  const byBusiness = new Map<string, SettlementLine>()
  for (const v of vouchers) {
    const line = byBusiness.get(v.businessId) ?? {
      businessId: v.businessId, businessName: names.get(v.businessId) ?? v.businessId, voucherIds: [], grossAgorot: 0,
      commissionAgorot: 0, netAgorot: 0, notYetDue: 0, blocked: null,
    }
    byBusiness.set(v.businessId, line)
    const terms = parseFrozenTerms(v)
    if (!terms) { line.blocked ??= 'missing_terms'; continue }
    if (!Number.isSafeInteger(v.amountAgorot) || (v.amountAgorot as number) <= 0) { line.blocked ??= 'missing_amount'; continue }
    if (!v.redeemedAt || !dueBy(valueDate, v.redeemedAt, paymentTermsDays(terms.paymentTerms))) { line.notYetDue++; continue }
    const gross = v.amountAgorot as number
    const commission = commissionAgorot(gross, terms.commissionRate)
    line.voucherIds.push(v.id)
    line.grossAgorot += gross
    line.commissionAgorot += commission
    line.netAgorot += gross - commission
  }
  const lines = [...byBusiness.values()].sort((a, b) => a.businessName.localeCompare(b.businessName))
  for (const line of lines) {
    if (line.voucherIds.length === 0) { line.blocked ??= 'nothing_due'; continue }
    const bank = hasBank(line.businessId)
    if (bank === 'missing') line.blocked ??= 'missing_bank_details'
    else if (bank === 'invalid') line.blocked ??= 'invalid_bank_details'
  }
  const ready = lines.filter((l) => !l.blocked && l.netAgorot > 0)
  // A merchant with some blocked vouchers (bad terms, say) is held back whole: paying part would hide the problem.
  return {
    valueDate, lines,
    readyCount: ready.length, readyVouchers: ready.reduce((s, l) => s + l.voucherIds.length, 0), readyNetAgorot: ready.reduce((s, l) => s + l.netAgorot, 0),
  }
}

interface Bank { bankCode: string; branchCode: string; accountNumber: string; taxId: string }

// The bank details in a businessFinancials snapshot; null when there are none. Throws if they can't be decrypted.
function bankOf(businessId: string, snap: DocumentSnapshot): Bank | null {
  const d = snap.data()
  if (!d) return null
  const open = (cipher: unknown, field: string) => decryptField('BUSINESS_FINANCIALS_KEY', String(cipher), `businessFinancials/${businessId}:${field}`)
  return { bankCode: open(d.bankCodeCipher, 'bankCode'), branchCode: open(d.branchCipher, 'branch'), accountNumber: open(d.accountCipher, 'account'), taxId: open(d.taxIdCipher, 'taxId') }
}

// Every business and its financials for a payout, in one batched read (db.getAll),
// not two reads per business.
async function loadBusinesses(db: Firestore, ids: readonly string[]) {
  const unique = [...new Set(ids)]
  const snaps = await getAllById(db, [
    ...unique.map((id) => db.collection('businesses').doc(id)),
    ...unique.map((id) => db.collection('businessFinancials').doc(id)),
  ])
  return {
    business: (id: string) => snaps.get(`businesses/${id}`)!,
    financials: (id: string) => snaps.get(`businessFinancials/${id}`)!,
  }
}

const validBank = (b: Bank) => /^\d{2}$/.test(b.bankCode) && /^\d{3}$/.test(b.branchCode) && /^\d{4,9}$/.test(b.accountNumber) && /^\d{9}$/.test(b.taxId)
  && !(b.bankCode === '10' && b.accountNumber.length > 8)

export function assertValueDate(valueDate: unknown, now = new Date()): asserts valueDate is string {
  if (typeof valueDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(valueDate) || Number.isNaN(Date.parse(valueDate))) throw new SettlementError('Choose a valid payment date.', 400)
  const today = Date.parse(now.toISOString().slice(0, 10))
  const days = (Date.parse(valueDate) - today) / 86_400_000
  if (days < 0 || days > 60) throw new SettlementError('The payment date must be within the next 60 days.', 400)
}

async function dueVouchers(db: Firestore) {
  const snap = await db.collection('vouchers')
    .where('status', '==', 'redeemed').where('fulfillmentType', '==', 'direct_merchant').where('payoutBatchId', '==', null).get()
  return snap.docs.map((d) => ({
    id: d.id, businessId: String(d.get('businessId') ?? ''), amountAgorot: d.get('amountAgorot'),
    commissionRate: d.get('commissionRate'), paymentTerms: d.get('paymentTerms'),
    redeemedAt: d.get('redeemedAt') instanceof Timestamp ? (d.get('redeemedAt') as Timestamp) : null,
  }))
}

/** Writes nothing: what a payout dated `valueDate` would contain, and who is held back and why. */
export async function previewSettlement(db: Firestore, valueDate: string): Promise<SettlementPreview> {
  const vouchers = await dueVouchers(db)
  const ids = [...new Set(vouchers.map((v) => v.businessId))]
  const names = new Map<string, string>()
  const banks = new Map<string, 'ok' | 'missing' | 'invalid'>()
  const loaded = await loadBusinesses(db, ids)
  for (const id of ids) {
    const biz = loaded.business(id)
    let bank: Bank | null | 'invalid'
    try { bank = bankOf(id, loaded.financials(id)) } catch { bank = 'invalid' }
    names.set(id, String(biz.get('legalName') || biz.get('businessName') || id))
    banks.set(id, bank === null ? 'missing' : bank === 'invalid' ? 'invalid' : validBank(bank) ? 'ok' : 'invalid')
  }
  return planSettlement(valueDate, vouchers, names, (id) => banks.get(id) ?? 'missing')
}

export interface FileStore {
  save(path: string, bytes: Uint8Array, contentType: string): Promise<void>
  read(path: string): Promise<Uint8Array>
}

export interface CreatedBatch { batchId: string; fileName: string; voucherCount: number; totalAgorot: number; mock: boolean }

/**
 * Locks every due voucher of every payable merchant under one new batch and
 * writes the MASAV file. Each chunk of vouchers is stamped in a transaction
 * that re-checks the voucher is still unpaid, so a concurrent batch or a refund
 * can't be overwritten; if a chunk finds a changed voucher, the chunks already
 * stamped are released and nothing is paid.
 */
export async function createPayoutBatch(
  db: Firestore, store: FileStore, request: Request, valueDate: string, now = new Date(), config: MasavConfig = masavConfig(),
): Promise<CreatedBatch> {
  assertValueDate(valueDate, now)
  const preview = await previewSettlement(db, valueDate)
  const payable = preview.lines.filter((l) => !l.blocked && l.netAgorot > 0)
  if (payable.length === 0) throw new SettlementError('Nothing is ready to pay on that date.')

  const batchRef = db.collection(PAYOUTS).doc()
  const createdAt = Timestamp.fromDate(now)
  await batchRef.set({
    status: 'locking', valueDate, voucherCount: preview.readyVouchers, totalAgorot: preview.readyNetAgorot, merchantCount: payable.length,
    institutionCodeUsed: config.institutionCode, mock: config.isMock, createdAt, fileName: null, fileSha256: null, filePath: null,
  })
  const allIds = payable.flatMap((l) => l.voucherIds.map((id) => ({ id, businessId: l.businessId })))
  const locked: string[] = []
  const release = async () => {
    for (let i = 0; i < locked.length; i += LOCK_CHUNK) {
      const chunk = locked.slice(i, i + LOCK_CHUNK)
      await db.runTransaction(async (tx: Transaction) => {
        const refs = chunk.map((id) => db.collection('vouchers').doc(id))
        const snaps = await Promise.all(refs.map((r) => tx.get(r)))
        snaps.forEach((s, j) => { if (s.get('payoutBatchId') === batchRef.id) tx.update(refs[j]!, { payoutBatchId: null }) })
      })
    }
  }
  try {
    for (let i = 0; i < allIds.length; i += LOCK_CHUNK) {
      const chunk = allIds.slice(i, i + LOCK_CHUNK)
      await db.runTransaction(async (tx: Transaction) => {
        const refs = chunk.map(({ id }) => db.collection('vouchers').doc(id))
        const snaps = await Promise.all(refs.map((r) => tx.get(r)))
        snaps.forEach((s, j) => {
          if (s.get('status') !== 'redeemed' || s.get('fulfillmentType') !== 'direct_merchant' || s.get('payoutBatchId') !== null || s.get('businessId') !== chunk[j]!.businessId) {
            throw new SettlementError('A voucher changed while locking; nothing was paid. Preview again.')
          }
        })
        refs.forEach((r) => tx.update(r, { payoutBatchId: batchRef.id }))
      })
      locked.push(...chunk.map((c) => c.id))
    }
    const payments: MasavPayment[] = []
    const loaded = await loadBusinesses(db, payable.map((line) => line.businessId))
    for (const line of payable) {
      const bank = bankOf(line.businessId, loaded.financials(line.businessId))
      if (!bank || !validBank(bank)) throw new SettlementError(`${line.businessName}'s bank details changed; nothing was paid. Preview again.`)
      const biz = loaded.business(line.businessId)
      payments.push({ ...bank, name: String(biz.get('legalName') || biz.get('businessName') || ''), amountAgorot: line.netAgorot })
    }
    const file = buildMasavFile({ config, valueDate, createdAt: now.toISOString().slice(0, 10), payments })
    const bytes = encodeWindows1255(file.text)
    const fileName = masavFileName(config, valueDate, now)
    const filePath = `payouts/${batchRef.id}/${fileName}`
    await store.save(filePath, bytes, 'text/plain; charset=windows-1255')
    await db.runTransaction(async (tx: Transaction) => {
      await tx.get(batchRef)
      tx.update(batchRef, { status: 'file_generated', fileName, filePath, fileSha256: createHash('sha256').update(bytes).digest('hex'), generatedAt: Timestamp.now() })
      payable.forEach((line) => tx.set(batchRef.collection('lines').doc(line.businessId), {
        businessId: line.businessId, businessName: line.businessName, voucherIds: line.voucherIds, voucherCount: line.voucherIds.length,
        grossAgorot: line.grossAgorot, commissionAgorot: line.commissionAgorot, netAgorot: line.netAgorot,
      }))
      auditInTransaction(db, tx, request, {
        action: 'payout.create', targetType: 'payoutBatch', targetId: batchRef.id,
        after: { valueDate, vouchers: allIds.length, merchants: payable.length, totalAgorot: file.totalAgorot, mock: config.isMock },
      })
    })
    return { batchId: batchRef.id, fileName, voucherCount: allIds.length, totalAgorot: file.totalAgorot, mock: config.isMock }
  } catch (err) {
    await release().catch((e) => console.error('Releasing payout locks failed', e))
    await batchRef.update({ status: 'void', voidReason: 'failed while locking' }).catch(() => {})
    throw err
  }
}

/** Releases a batch's vouchers so they can be paid in a later one. A batch marked paid can't be voided. */
export async function voidPayoutBatch(db: Firestore, request: Request, batchId: string): Promise<void> {
  const batchRef = db.collection(PAYOUTS).doc(batchId)
  const batch = (await batchRef.get()).data()
  if (!batch) throw new SettlementError('Batch not found.', 404)
  if (batch.status === 'paid') throw new SettlementError('A batch already marked paid can\'t be voided.')
  if (batch.status === 'void') throw new SettlementError('Already void.')
  const lines = await batchRef.collection('lines').get()
  const ids = lines.docs.flatMap((l) => l.get('voucherIds') as string[])
  for (let i = 0; i < ids.length; i += LOCK_CHUNK) {
    const chunk = ids.slice(i, i + LOCK_CHUNK)
    await db.runTransaction(async (tx: Transaction) => {
      const refs = chunk.map((id) => db.collection('vouchers').doc(id))
      const snaps = await Promise.all(refs.map((r) => tx.get(r)))
      snaps.forEach((s, j) => { if (s.get('payoutBatchId') === batchId) tx.update(refs[j]!, { payoutBatchId: null }) })
    })
  }
  await db.runTransaction(async (tx: Transaction) => {
    await tx.get(batchRef)
    tx.update(batchRef, { status: 'void', voidedAt: Timestamp.now() })
    auditInTransaction(db, tx, request, { action: 'payout.void', targetType: 'payoutBatch', targetId: batchId })
  })
}

export async function markPayoutPaid(db: Firestore, request: Request, batchId: string): Promise<void> {
  const ref = db.collection(PAYOUTS).doc(batchId)
  await db.runTransaction(async (tx: Transaction) => {
    const snap = await tx.get(ref)
    if (!snap.exists) throw new SettlementError('Batch not found.', 404)
    if (snap.get('status') !== 'file_generated') throw new SettlementError('Only a batch with a generated file can be marked paid.')
    tx.update(ref, { status: 'paid', paidAt: Timestamp.now() })
    auditInTransaction(db, tx, request, { action: 'payout.markPaid', targetType: 'payoutBatch', targetId: batchId })
  })
}

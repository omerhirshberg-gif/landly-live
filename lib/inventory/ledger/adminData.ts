import 'server-only'
import { Timestamp, type Firestore } from 'firebase-admin/firestore'
import { ALERTS_COLLECTION, BATCHES_COLLECTION, BUSINESS_CHANGES_COLLECTION, PRODUCTS_COLLECTION, VOUCHER_STATUSES } from './types'
import { countByStatus } from './stock'

const iso = (v: unknown) => (v instanceof Timestamp ? v.toDate().toISOString() : null)

/** Everything the ledger tabs of /admin/inventory show. Counts only: never a code. */
export async function readLedgerOverview(db: Firestore) {
  const [products, batches, alerts, changes] = await Promise.all([
    db.collection(PRODUCTS_COLLECTION).get(),
    db.collection(BATCHES_COLLECTION).orderBy('importedAt', 'desc').limit(30).get(),
    db.collection(ALERTS_COLLECTION).where('resolvedAt', '==', null).orderBy('createdAt', 'desc').limit(100).get(),
    db.collection(BUSINESS_CHANGES_COLLECTION).where('status', '==', 'pending').orderBy('detectedAt', 'desc').limit(200).get(),
  ])
  const productRows = await Promise.all(products.docs.map(async (d) => {
    const p = d.data()
    const counts: Record<string, number> = {}
    for (const status of ['IN_STOCK', 'RESERVED', 'SOLD', 'DELIVERED', 'PARTIALLY_REDEEMED', 'REDEEMED', 'CANCELLED'] as const) counts[status] = await countByStatus(db, d.id, status)
    return {
      id: d.id, supplierId: p.supplierId, title: p.title ?? '', faceValueAgorot: p.faceValueAgorot, salePriceAgorot: p.salePriceAgorot, costPriceAgorot: p.costPriceAgorot ?? 0,
      issueMode: p.issueMode, active: p.active !== false, lowStockThreshold: p.lowStockThreshold ?? 10, businessId: p.businessId ?? null, counts,
    }
  }))
  void VOUCHER_STATUSES
  return {
    products: productRows.sort((a, b) => a.faceValueAgorot - b.faceValueAgorot),
    batches: batches.docs.map((d) => {
      const b = d.data()
      return {
        id: d.id, supplierId: b.supplierId, fileName: b.fileName, rowsTotal: b.rowsTotal, rowsOk: b.rowsOk, rowsRejected: b.rowsRejected, status: b.status,
        invoiceTotalExpectedAgorot: b.invoiceTotalExpectedAgorot, invoiceTotalActualAgorot: b.invoiceTotalActualAgorot, importedAt: iso(b.importedAt), approvedAt: iso(b.approvedAt),
        expiresAt: iso(b.expiresAt), stagingComplete: b.stagingComplete === true, totalsOverride: b.totalsOverride ?? null,
      }
    }),
    alerts: alerts.docs.map((d) => ({ id: d.id, ...(d.data() as object), createdAt: iso(d.data().createdAt), resolvedAt: null })),
    changes: changes.docs.map((d) => { const c = d.data(); return { id: d.id, kind: c.kind, nameHe: c.nameHe, nameEn: c.nameEn, before: c.before, after: c.after, day: c.day, known: c.payload?.known === true } }),
  }
}

const CSV_REASONS: Record<string, string> = {
  empty: 'Empty code', duplicate_in_file: 'Repeated in the file', duplicate_in_stock: 'Already in stock', too_long: 'Code too long', bad_amount: 'Invalid face value', wrong_amount: 'Wrong face value', no_product: 'No product for this face value',
}

/** The rejected-rows report of one batch as CSV (UTF-8 with BOM for Excel). The code itself is never in it, only its last 4 characters. */
export function rejectedRowsCsv(rows: readonly { row: number; reason: string; codeTail: string; amountAgorot: number | null }[]): string {
  const lines = ['row,reason,code_last4,face_value', ...rows.map((r) => `${r.row},"${CSV_REASONS[r.reason] ?? r.reason}",${r.codeTail},${r.amountAgorot === null ? '' : r.amountAgorot / 100}`)]
  return `﻿${lines.join('\r\n')}\r\n`
}

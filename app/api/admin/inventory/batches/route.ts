import { NextResponse } from 'next/server'
import { requireAdminAuth } from '@/lib/admin/adminAuth'
import { writeAudit } from '@/lib/admin/auditLog'
import { CipherConfigError } from '@/lib/crypto/fieldCipher'
import { getAdminDb } from '@/lib/firebase/admin'
import { safeErrorText } from '@/lib/inventory/ledger/codes'
import { MAX_ROWS_PER_BATCH, stageBatch } from '@/lib/inventory/ledger/importBatch'
import { PaymentError } from '@/lib/payments/paymentValidation'

// Stages a Raayonit sheet as a pending batch. The browser parsed the file (lib/inventory/readCodeSheetFile.ts); every row is
// re-validated here. Nothing is sellable until the batch is approved. The response and the audit entry carry counts only.
export const maxDuration = 120

export async function POST(request: Request) {
  const denied = requireAdminAuth(request)
  if (denied) return denied
  const body = await request.json().catch(() => null)
  if (!body || !Array.isArray(body.rows)) return NextResponse.json({ error: 'Send the sheet rows.' }, { status: 400 })
  if (body.rows.length > MAX_ROWS_PER_BATCH) return NextResponse.json({ error: `At most ${MAX_ROWS_PER_BATCH} rows per import.` }, { status: 400 })
  try {
    const db = getAdminDb()
    const expires = typeof body.expiresAt === 'string' && body.expiresAt ? new Date(body.expiresAt) : null
    if (expires && Number.isNaN(expires.getTime())) throw new PaymentError('Invalid expiry date.', 400)
    const result = await stageBatch(db, {
      supplierId: 'raayonit', fileName: String(body.fileName ?? 'upload'), rows: body.rows.map((r: { code?: unknown; amount?: unknown }) => ({ code: r?.code, amount: r?.amount })),
      invoiceTotalExpectedAgorot: Math.round(Number(body.invoiceTotal) * 100), expiresAt: expires, importedBy: 'admin',
    })
    await writeAudit(db, request, { action: 'inventory.batch.stage', targetType: 'importBatch', targetId: result.batchId, after: { rowsTotal: result.rowsTotal, rowsOk: result.rowsOk, rowsRejected: result.rowsRejected, totalsMatch: result.totalsMatch } })
    return NextResponse.json(result)
  } catch (error) {
    if (error instanceof PaymentError) return NextResponse.json({ error: error.message }, { status: error.status })
    if (error instanceof CipherConfigError) return NextResponse.json({ error: 'Code encryption key is not configured on the server.' }, { status: 503 })
    console.error('Batch staging failed', safeErrorText(error))
    return NextResponse.json({ error: 'Could not stage the import.' }, { status: 500 })
  }
}

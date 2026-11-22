import { NextResponse } from 'next/server'
import { requireAdminAuth } from '@/lib/admin/adminAuth'
import { writeAudit } from '@/lib/admin/auditLog'
import { getAdminDb } from '@/lib/firebase/admin'
import { rejectedRowsCsv } from '@/lib/inventory/ledger/adminData'
import { safeErrorText } from '@/lib/inventory/ledger/codes'
import { approveBatch, rejectBatch } from '@/lib/inventory/ledger/importBatch'
import { BATCHES_COLLECTION } from '@/lib/inventory/ledger/types'
import { PaymentError } from '@/lib/payments/paymentValidation'

type Params = { params: Promise<{ batchId: string }> }
export const maxDuration = 300

// GET: the batch's persisted rejected rows (`?format=csv` downloads the report again, any time).
export async function GET(request: Request, { params }: Params) {
  const denied = requireAdminAuth(request)
  if (denied) return denied
  const { batchId } = await params
  const snap = await getAdminDb().collection(BATCHES_COLLECTION).doc(batchId).get()
  if (!snap.exists) return NextResponse.json({ error: 'Import batch not found.' }, { status: 404 })
  const rows = (snap.data()!.rejectedRows ?? []) as { row: number; reason: string; codeTail: string; amountAgorot: number | null }[]
  if (new URL(request.url).searchParams.get('format') === 'csv') {
    return new NextResponse(rejectedRowsCsv(rows), { headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="rejected-rows-${batchId.slice(0, 20)}.csv"`, 'Cache-Control': 'no-store' } })
  }
  return NextResponse.json({ rejectedRows: rows })
}

// POST { action: 'approve' | 'reject', mismatchReason?, reason? }
export async function POST(request: Request, { params }: Params) {
  const denied = requireAdminAuth(request)
  if (denied) return denied
  const { batchId } = await params
  const body = await request.json().catch(() => null)
  try {
    const db = getAdminDb()
    if (body?.action === 'approve') {
      const result = await approveBatch(db, batchId, { approvedBy: 'admin', mismatchReason: typeof body.mismatchReason === 'string' ? body.mismatchReason : undefined })
      await writeAudit(db, request, { action: 'inventory.batch.approve', targetType: 'importBatch', targetId: batchId, after: { ...result, mismatchReason: body.mismatchReason ?? null } })
      return NextResponse.json(result)
    }
    if (body?.action === 'reject') {
      const voided = await rejectBatch(db, batchId, { reason: String(body.reason ?? ''), actor: 'admin' })
      await writeAudit(db, request, { action: 'inventory.batch.reject', targetType: 'importBatch', targetId: batchId, after: { voided, reason: body.reason } })
      return NextResponse.json({ voided })
    }
    return NextResponse.json({ error: 'Unknown action.' }, { status: 400 })
  } catch (error) {
    if (error instanceof PaymentError) return NextResponse.json({ error: error.message }, { status: error.status })
    console.error('Batch action failed', safeErrorText(error))
    return NextResponse.json({ error: 'Could not complete the action.' }, { status: 500 })
  }
}

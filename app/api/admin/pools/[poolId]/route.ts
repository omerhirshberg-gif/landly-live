import { NextResponse } from 'next/server'
import { Timestamp } from 'firebase-admin/firestore'
import { requireAdminAuth } from '@/lib/admin/adminAuth'
import { writeAudit } from '@/lib/admin/auditLog'
import { getAdminDb } from '@/lib/firebase/admin'
import { POOL_COLLECTION } from '@/lib/inventory/types'
import { isDocumentId } from '@/lib/payments/paymentValidation'

// Change a pool's low-stock threshold, or archive / reactivate it.
export async function PATCH(request: Request, { params }: { params: Promise<{ poolId: string }> }) {
  const authError = requireAdminAuth(request)
  if (authError) return authError
  const { poolId } = await params
  if (!isDocumentId(poolId)) return NextResponse.json({ error: 'Invalid pool.' }, { status: 400 })
  const body = await request.json().catch(() => null)
  const db = getAdminDb()
  const ref = db.collection(POOL_COLLECTION).doc(poolId)
  const snap = await ref.get()
  const pool = snap.data()
  if (!pool) return NextResponse.json({ error: 'Pool not found.' }, { status: 404 })
  const update: Record<string, unknown> = { updatedAt: Timestamp.now() }
  if (body?.warningThreshold !== undefined) {
    if (!Number.isInteger(body.warningThreshold) || body.warningThreshold < 0) return NextResponse.json({ error: 'Invalid threshold.' }, { status: 400 })
    update.warningThreshold = body.warningThreshold
    update.lowStock = pool.remainingCount <= body.warningThreshold
  }
  if (body?.archived !== undefined) {
    update.status = body.archived ? 'archived' : pool.remainingCount > 0 ? 'active' : 'depleted'
  }
  if (Object.keys(update).length === 1) return NextResponse.json({ error: 'Nothing to change.' }, { status: 400 })
  await ref.update(update)
  await writeAudit(db, request, { action: 'pool.update', targetType: 'pool', targetId: poolId, before: { warningThreshold: pool.warningThreshold, status: pool.status }, after: update })
  return NextResponse.json({ ok: true })
}

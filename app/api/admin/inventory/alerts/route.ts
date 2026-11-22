import { NextResponse } from 'next/server'
import { Timestamp } from 'firebase-admin/firestore'
import { requireAdminAuth } from '@/lib/admin/adminAuth'
import { getAdminDb } from '@/lib/firebase/admin'
import { runInventoryAlerts } from '@/lib/inventory/ledger/alerts'
import { ALERTS_COLLECTION } from '@/lib/inventory/ledger/types'

// POST { action: 'resolve', id } marks one alert handled; POST { action: 'run' } runs today's check now (idempotent).
export async function POST(request: Request) {
  const denied = requireAdminAuth(request)
  if (denied) return denied
  const body = await request.json().catch(() => null)
  const db = getAdminDb()
  if (body?.action === 'run') return NextResponse.json(await runInventoryAlerts(db))
  if (body?.action === 'resolve' && typeof body.id === 'string' && body.id) {
    await db.collection(ALERTS_COLLECTION).doc(body.id).update({ resolvedAt: Timestamp.now() })
    return NextResponse.json({ ok: true })
  }
  return NextResponse.json({ error: 'Unknown action.' }, { status: 400 })
}

import { NextResponse } from 'next/server'
import { requireAdminAuth } from '@/lib/admin/adminAuth'
import { auditInTransaction } from '@/lib/admin/auditLog'
import { getAdminDb } from '@/lib/firebase/admin'
import { INVITE_COLLECTION } from '@/lib/merchants/invites'

export async function POST(request: Request, { params }: { params: Promise<{ hash: string }> }) {
  const authError = requireAdminAuth(request)
  if (authError) return authError
  const { hash } = await params
  if (!/^[0-9a-f]{64}$/.test(hash)) return NextResponse.json({ error: 'Invalid invite.' }, { status: 400 })
  const db = getAdminDb()
  const ref = db.collection(INVITE_COLLECTION).doc(hash)
  const outcome = await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref)
    if (!snap.exists) return 'missing' as const
    if (snap.get('status') !== 'pending' && snap.get('status') !== 'opened') return 'closed' as const
    tx.update(ref, { status: 'revoked' })
    auditInTransaction(db, tx, request, { action: 'merchantInvite.revoke', targetType: 'invite', targetId: hash.slice(0, 12) })
    return 'ok' as const
  })
  if (outcome === 'missing') return NextResponse.json({ error: 'Invite not found.' }, { status: 404 })
  if (outcome === 'closed') return NextResponse.json({ error: 'Only an open invite can be revoked.' }, { status: 409 })
  return NextResponse.json({ ok: true })
}

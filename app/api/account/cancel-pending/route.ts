import { NextResponse } from 'next/server'
import { getAdminDb } from '@/lib/firebase/admin'
import { CLEAR_PENDING_EMAIL, CLEAR_PENDING_PHONE, customerOrReply, logContactFailure, preflight, replyFor } from '@/lib/account/contactChangeServer'

// "Cancel change" on the profile's amber notice ({ kind: 'email' | 'phone' }):
// drops the pending value and its server-only token or code, so a link or
// code already sent stops working. The live email or phone never changed.
export function OPTIONS(request: Request) {
  return preflight(request)
}

export async function POST(request: Request) {
  const reply = replyFor(request)
  const decoded = await customerOrReply(request, reply)
  if (decoded instanceof NextResponse) return decoded
  const { uid } = decoded

  const body = await request.json().catch(() => null)
  const kind = body?.kind
  if (kind !== 'email' && kind !== 'phone') return reply({ error: 'Unknown change.', reason: 'invalid' }, 400)

  const db = getAdminDb()
  try {
    const batch = db.batch()
    batch.delete(db.collection(kind === 'email' ? 'emailChangeRequests' : 'phoneVerifications').doc(uid))
    batch.update(db.collection('users').doc(uid), kind === 'email' ? CLEAR_PENDING_EMAIL : CLEAR_PENDING_PHONE)
    await batch.commit()
  } catch (err) {
    logContactFailure('cancel-pending', kind, uid, err)
    return reply({ error: 'Service unavailable.', reason: 'unavailable' }, 503)
  }
  return reply({ ok: true })
}

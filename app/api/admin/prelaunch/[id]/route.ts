import { FieldValue } from 'firebase-admin/firestore'
import { NextResponse } from 'next/server'
import { requireAdminAuth } from '@/lib/admin/adminAuth'
import { getAdminDb } from '@/lib/firebase/admin'
import { LEADS_COLLECTION } from '@/lib/prelaunch/leads.server'

// PATCH /api/admin/prelaunch/{id} {invalid: boolean}: flag a lead as invalid
// (a mistyped address that only bounces) or restore it. A soft flag, never a
// delete, so its referral code, its referrals and the founding-member order
// stay intact; flagged leads drop out of the list, the CSV and newsletter
// audiences. Reads and writes through getAdminDb (PROD in Production, DEV
// elsewhere).
const NO_STORE = { 'Cache-Control': 'no-store' }
const LEAD_ID_RE = /^[A-Za-z0-9_-]{6,64}$/

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const authError = requireAdminAuth(request)
  if (authError) return authError
  const { id } = await params
  if (!LEAD_ID_RE.test(id)) return NextResponse.json({ error: 'invalid_id' }, { status: 400, headers: NO_STORE })
  const body = (await request.json().catch(() => null)) as { invalid?: unknown } | null
  if (!body || typeof body.invalid !== 'boolean') return NextResponse.json({ error: 'invalid_body' }, { status: 400, headers: NO_STORE })
  try {
    const ref = getAdminDb().collection(LEADS_COLLECTION).doc(id)
    if (!(await ref.get()).exists) return NextResponse.json({ error: 'not_found' }, { status: 404, headers: NO_STORE })
    await ref.update(body.invalid ? { invalid: true, invalidAt: FieldValue.serverTimestamp() } : { invalid: FieldValue.delete(), invalidAt: FieldValue.delete() })
    return NextResponse.json({ ok: true }, { headers: NO_STORE })
  } catch (error) {
    console.error('Pre-launch lead flag failed', error instanceof Error ? error.message : 'unknown error')
    return NextResponse.json({ error: 'failed' }, { status: 502, headers: NO_STORE })
  }
}

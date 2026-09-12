import { NextResponse } from 'next/server'
import { requireAdminAuth } from '@/lib/admin/adminAuth'
import { getAdminAuth, getAdminDb } from '@/lib/firebase/admin'

export async function DELETE(request: Request, { params }: { params: Promise<{ uid: string }> }) {
  const authError = requireAdminAuth(request)
  if (authError) return authError

  const { uid } = await params
  const adminDb = getAdminDb()

  // Re-check on the server right before deleting -- the client's list may be
  // stale, and this account must still be a genuine orphan (never resolve by
  // email, only by this exact uid matching neither collection).
  const [businessSnap, userSnap] = await Promise.all([
    adminDb.collection('businesses').doc(uid).get(),
    adminDb.collection('users').doc(uid).get(),
  ])
  if (businessSnap.exists || userSnap.exists) {
    return NextResponse.json({ error: 'This account now has a matching record and is not an orphan.' }, { status: 409 })
  }

  try {
    await getAdminAuth().deleteUser(uid)
  } catch (err: unknown) {
    const code = (err as { code?: string })?.code
    if (code !== 'auth/user-not-found') {
      return NextResponse.json({ error: 'Failed to delete the login account.' }, { status: 500 })
    }
  }

  return NextResponse.json({ ok: true })
}

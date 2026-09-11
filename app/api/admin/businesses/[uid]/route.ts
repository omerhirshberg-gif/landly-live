import { NextResponse } from 'next/server'
import { isAdminPassword } from '@/lib/admin/checkAdminPassword'
import { getAdminAuth, getAdminDb } from '@/lib/firebase/admin'

export async function DELETE(request: Request, { params }: { params: Promise<{ uid: string }> }) {
  const authHeader = request.headers.get('authorization') ?? ''
  const password = authHeader.startsWith('Bearer ') ? authHeader.slice('Bearer '.length) : null
  if (!isAdminPassword(password)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const adminDb = getAdminDb()

  const { uid } = await params
  const businessRef = adminDb.collection('businesses').doc(uid)
  const businessSnap = await businessRef.get()
  if (!businessSnap.exists) {
    return NextResponse.json({ error: 'Business not found.' }, { status: 404 })
  }

  // Auth goes first: a login account left behind after Firestore cleanup
  // silently blocks its email from ever being reused (the orphan problem).
  // A leftover Firestore doc if the second step below fails is harmless by
  // comparison -- it's inert and doesn't block anything -- so that's the
  // direction this is allowed to fail in.
  try {
    await getAdminAuth().deleteUser(uid)
  } catch (err: unknown) {
    const code = (err as { code?: string })?.code
    if (code !== 'auth/user-not-found') {
      return NextResponse.json({ error: 'Failed to remove the login account. Nothing was deleted; please retry.' }, { status: 500 })
    }
  }

  // Cascade: an offer left behind after its business is gone would break
  // claiming for it (claimOffer's transaction updates the business doc,
  // which would no longer exist) -- vouchers already claimed are untouched,
  // they're self-contained via denormalized fields.
  const offersSnap = await adminDb.collection('offers').where('businessId', '==', uid).get()
  try {
    const batch = adminDb.batch()
    for (const doc of offersSnap.docs) batch.delete(doc.ref)
    batch.delete(businessRef)
    await batch.commit()
  } catch {
    return NextResponse.json({
      error: 'The login account was removed, but deleting the business and offer records failed. They need manual cleanup in Firestore -- the email is already freed for reuse.',
    }, { status: 500 })
  }

  return NextResponse.json({ deletedOfferCount: offersSnap.size })
}

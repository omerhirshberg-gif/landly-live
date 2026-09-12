import { NextResponse } from 'next/server'
import { Timestamp } from 'firebase-admin/firestore'
import { getOfferStatus } from '@/lib/admin/offerStatus'
import { getAdminDb } from '@/lib/firebase/admin'
import { getUidFromRequest } from '@/lib/firebase/verifyRequestUser'

// The business dashboard's read-only offers list. uid comes only from the
// verified Firebase ID token (see getUidFromRequest) -- there is no
// businessId param anywhere on this route, so a signed-in business can never
// query another business's offers by any request it can construct.
export async function GET(request: Request) {
  const uid = await getUidFromRequest(request)
  if (!uid) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Sorted in-memory (not via orderBy) so this doesn't need a composite
  // Firestore index, same as app/api/admin/offers.
  const snap = await getAdminDb().collection('offers').where('businessId', '==', uid).get()
  const offers = snap.docs
    .map((doc) => {
      const data = doc.data()
      const expiryDate = data.expiryDate instanceof Timestamp ? data.expiryDate.toDate() : null
      const totalQuantity = typeof data.totalQuantity === 'number' ? data.totalQuantity : null
      const claimedCount = Number(data.claimedCount) || 0
      return {
        id: doc.id,
        title: data.title ?? '',
        originalPrice: Number(data.originalPrice) || 0,
        offerPrice: Number(data.offerPrice) || 0,
        totalQuantity,
        claimedCount,
        status: getOfferStatus({ totalQuantity, claimedCount, expiryDate }),
      }
    })
    .sort((a, b) => a.title.localeCompare(b.title))

  return NextResponse.json({ offers })
}

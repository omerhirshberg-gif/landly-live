import { checkUidRateLimit } from '@/lib/auth/uidRateLimit'
import { NextResponse } from 'next/server'
import { Timestamp } from 'firebase-admin/firestore'
import { getOfferStatus } from '@/lib/admin/offerStatus'
import { getAdminDb } from '@/lib/firebase/admin'
import { requireBusinessUid, RequestAuthError } from '@/lib/firebase/verifyRequestUser'
import { parsePageParams, pageResponse } from '@/lib/business/pagination'

// The business dashboard's read-only offers list. uid comes only from the
// verified Firebase ID token (see requireBusinessUid) -- there is no
// businessId param anywhere on this route, so a signed-in business can never
// query another business's offers by any request it can construct.
export async function GET(request: Request) {
  let uid: string
  try { uid = await requireBusinessUid(request) }
  catch (error) {
    if (error instanceof RequestAuthError) return NextResponse.json({ error: error.message }, { status: error.status })
    return NextResponse.json({ error: 'Authorization service unavailable.' }, { status: 503 })
  }
  const limited = checkUidRateLimit('business', uid)
  if (limited) return limited
  let page
  const scope = `${uid}:offers`
  try { page = parsePageParams(request, scope) }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : 'Invalid pagination.' }, { status: 400 }) }

  // Sorted in-memory (not via orderBy) so this doesn't need a composite
  // Firestore index, same as app/api/admin/offers.
  let query = getAdminDb().collection('offers').where('businessId', '==', uid)
    .orderBy('title').orderBy('__name__').limit(page.limit + 1)
  if (page.cursor) query = query.startAfter(page.cursor.value, page.cursor.id)
  const snap = await query.get()
  const hasMore = snap.docs.length > page.limit
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
    .slice(0, page.limit)

  return pageResponse({ offers }, hasMore, snap.docs[Math.min(page.limit, snap.docs.length) - 1], scope, (doc) => {
    const title = doc.data().title
    return [typeof title === 'string' ? title : '', doc.id]
  })
}

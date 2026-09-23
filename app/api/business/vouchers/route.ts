import { checkUidRateLimit } from '@/lib/auth/uidRateLimit'
import { NextResponse } from 'next/server'
import { Timestamp } from 'firebase-admin/firestore'
import { getAdminDb } from '@/lib/firebase/admin'
import { requireBusinessUid, RequestAuthError } from '@/lib/firebase/verifyRequestUser'
import { parsePageParams, pageResponse } from '@/lib/business/pagination'

type VoucherStatus = 'active' | 'redeemed'

function parseStatus(request: Request): VoucherStatus | null {
  const raw = new URL(request.url).searchParams.get('status')
  // Only ever the two literal values below get near a Firestore query --
  // anything else (missing, typo'd, an injection attempt) is rejected
  // outright rather than passed through.
  return raw === 'active' || raw === 'redeemed' ? raw : null
}

// Backs both "Active Vouchers" and "Redemption History" on the business
// dashboard. Like /api/business/offers, uid comes only from the verified ID
// token -- no businessId is ever accepted from the client, so this can't be
// used to read another business's vouchers.
export async function GET(request: Request) {
  let uid: string
  try { uid = await requireBusinessUid(request) }
  catch (error) {
    if (error instanceof RequestAuthError) return NextResponse.json({ error: error.message }, { status: error.status })
    return NextResponse.json({ error: 'Authorization service unavailable.' }, { status: 503 })
  }
  const limited = checkUidRateLimit('business', uid)
  if (limited) return limited

  const status = parseStatus(request)
  if (!status) return NextResponse.json({ error: 'status must be "active" or "redeemed".' }, { status: 400 })
  let page
  const scope = `${uid}:vouchers:${status}`
  try { page = parsePageParams(request, scope) }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : 'Invalid pagination.' }, { status: 400 }) }

  // Two equality (==) filters need no composite index in Firestore -- only
  // combining equality with a range/orderBy on a different field would.
  const sortField = status === 'redeemed' ? 'redeemedAt' : 'takenAt'
  let query = getAdminDb()
    .collection('vouchers')
    .where('businessId', '==', uid)
    .where('status', '==', status)
    .orderBy(sortField, 'desc').orderBy('__name__', 'desc').limit(page.limit + 1)
  if (page.cursor) {
    try {
      const cursorValue = page.cursor.value === null ? null : Timestamp.fromDate(new Date(page.cursor.value))
      if (cursorValue !== null && Number.isNaN(cursorValue.toMillis())) return NextResponse.json({ error: 'cursor is invalid.' }, { status: 400 })
      query = query.startAfter(cursorValue, page.cursor.id)
    } catch { return NextResponse.json({ error: 'cursor is invalid.' }, { status: 400 }) }
  }
  const snap = await query.get()

  const hasMore = snap.docs.length > page.limit
  const vouchers = snap.docs
    .map((doc) => {
      const data = doc.data()
      const takenAt = data.takenAt instanceof Timestamp ? data.takenAt.toDate() : null
      const redeemedAt = data.redeemedAt instanceof Timestamp ? data.redeemedAt.toDate() : null
      return {
        id: doc.id,
        offerTitle: data.offerTitle ?? '',
        takenAt: takenAt ? takenAt.toISOString() : null,
        redeemedAt: redeemedAt ? redeemedAt.toISOString() : null,
      }
    })
    .slice(0, page.limit)

  return pageResponse({ vouchers }, hasMore, snap.docs[Math.min(page.limit, snap.docs.length) - 1], scope, (doc) => {
    const value = doc.data()[sortField]
    return [value instanceof Timestamp ? value.toDate().toISOString() : null, doc.id]
  })
}

import { checkUidRateLimit } from '@/lib/auth/uidRateLimit'
import { createHash } from 'node:crypto'
import { NextResponse } from 'next/server'
import { Timestamp } from 'firebase-admin/firestore'
import { getAdminDb } from '@/lib/firebase/admin'
import { requireBusinessUid, RequestAuthError } from '@/lib/firebase/verifyRequestUser'
import { encodeTimeCursor, parseTimePageParams } from '@/lib/business/pagination'
import { normalizeDisplayOrderNumber } from '@/lib/payments/orderNumber'

type VoucherStatus = 'active' | 'redeemed'

function parseStatus(request: Request): VoucherStatus | null {
  const raw = new URL(request.url).searchParams.get('status')
  // Only ever the two literal values below get near a Firestore query --
  // anything else (missing, typo'd, an injection attempt) is rejected
  // outright rather than passed through.
  return raw === 'active' || raw === 'redeemed' ? raw : null
}

// A voucher's id is `${customerUid}_${offerId}`, so it never leaves this
// route: rows carry an opaque reference instead (a one-way hash, stable for
// React keys) and the order number the member also sees ("#1001"; null for
// vouchers from before numbering). The page cursor carries no id either
// (lib/business/pagination.ts TimeCursor).
function opaqueReference(voucherId: string): string {
  return createHash('sha256').update(`landly-voucher-ref:${voucherId}`).digest('hex').slice(0, 20)
}

const sameTime = (a: Timestamp | null, b: Timestamp | null) => (a === null || b === null ? a === b : a.isEqual(b))

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
  try { page = parseTimePageParams(request, scope) }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : 'Invalid pagination.' }, { status: 400 }) }

  // Two equality (==) filters need no composite index in Firestore -- only
  // combining equality with a range/orderBy on a different field would.
  const sortField = status === 'redeemed' ? 'redeemedAt' : 'takenAt'
  let query = getAdminDb()
    .collection('vouchers')
    .where('businessId', '==', uid)
    .where('status', '==', status)
    .orderBy(sortField, 'desc').orderBy('__name__', 'desc')
  const cursorAt = page.cursor ? (page.cursor.at === null ? null : new Timestamp(page.cursor.at.s, page.cursor.at.n)) : undefined
  if (page.cursor) query = query.startAt(cursorAt).offset(page.cursor.skip)
  const snap = await query.limit(page.limit + 1).get()

  const hasMore = snap.docs.length > page.limit
  const docs = snap.docs.slice(0, page.limit)
  const sortValue = (doc: (typeof docs)[number]) => {
    const value = doc.get(sortField)
    return value instanceof Timestamp ? value : null
  }
  const vouchers = docs.map((doc) => {
    const data = doc.data()
    const takenAt = data.takenAt instanceof Timestamp ? data.takenAt.toDate() : null
    const redeemedAt = data.redeemedAt instanceof Timestamp ? data.redeemedAt.toDate() : null
    return {
      id: opaqueReference(doc.id),
      orderNumber: normalizeDisplayOrderNumber(data.displayOrderNumber),
      offerTitle: data.offerTitle ?? '',
      takenAt: takenAt ? takenAt.toISOString() : null,
      redeemedAt: redeemedAt ? redeemedAt.toISOString() : null,
    }
  })

  let nextCursor: string | null = null
  const last = docs.at(-1)
  if (hasMore && last) {
    const lastAt = sortValue(last)
    // Rows on this page sharing the last row's value, plus those skipped
    // before it when this page started inside the same run of equal values.
    let skip = docs.filter((doc) => sameTime(sortValue(doc), lastAt)).length
    if (page.cursor && cursorAt !== undefined && sameTime(cursorAt, lastAt)) skip += page.cursor.skip
    nextCursor = encodeTimeCursor({ at: lastAt === null ? null : { s: lastAt.seconds, n: lastAt.nanoseconds }, skip, scope })
  }
  return NextResponse.json({ vouchers, nextCursor })
}

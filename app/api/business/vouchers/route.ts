import { NextResponse } from 'next/server'
import { Timestamp } from 'firebase-admin/firestore'
import { getAdminDb } from '@/lib/firebase/admin'
import { getUidFromRequest } from '@/lib/firebase/verifyRequestUser'

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
  const uid = await getUidFromRequest(request)
  if (!uid) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const status = parseStatus(request)
  if (!status) return NextResponse.json({ error: 'status must be "active" or "redeemed".' }, { status: 400 })

  // Two equality (==) filters need no composite index in Firestore -- only
  // combining equality with a range/orderBy on a different field would.
  const snap = await getAdminDb()
    .collection('vouchers')
    .where('businessId', '==', uid)
    .where('status', '==', status)
    .get()

  const sortKey = status === 'redeemed' ? 'redeemedAt' : 'takenAt'
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
    .sort((a, b) => (b[sortKey] ?? '').localeCompare(a[sortKey] ?? '')) // newest first

  return NextResponse.json({ vouchers })
}

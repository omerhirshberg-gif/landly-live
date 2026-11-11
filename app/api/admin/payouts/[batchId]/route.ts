import { NextResponse } from 'next/server'
import { Timestamp } from 'firebase-admin/firestore'
import { requireAdminAuth } from '@/lib/admin/adminAuth'
import { PAYOUTS, SettlementError, markPayoutPaid, voidPayoutBatch } from '@/lib/finance/settlement'
import { getAdminDb } from '@/lib/firebase/admin'
import { isDocumentId } from '@/lib/payments/paymentValidation'

const iso = (v: unknown) => (v instanceof Timestamp ? v.toDate().toISOString() : null)

export async function GET(request: Request, { params }: { params: Promise<{ batchId: string }> }) {
  const authError = requireAdminAuth(request)
  if (authError) return authError
  const { batchId } = await params
  if (!isDocumentId(batchId)) return NextResponse.json({ error: 'Invalid batch.' }, { status: 400 })
  const ref = getAdminDb().collection(PAYOUTS).doc(batchId)
  const [snap, lines] = await Promise.all([ref.get(), ref.collection('lines').get()])
  const b = snap.data()
  if (!b) return NextResponse.json({ error: 'Batch not found.' }, { status: 404 })
  return NextResponse.json({
    id: batchId, status: b.status, valueDate: b.valueDate, voucherCount: b.voucherCount, merchantCount: b.merchantCount, totalAgorot: b.totalAgorot,
    mock: !!b.mock, institutionCodeUsed: b.institutionCodeUsed, fileName: b.fileName ?? null, fileSha256: b.fileSha256 ?? null,
    createdAt: iso(b.createdAt), paidAt: iso(b.paidAt),
    // Only counts and money: no voucher ids, no bank details.
    lines: lines.docs.map((l) => ({ businessId: l.id, businessName: l.get('businessName'), voucherCount: l.get('voucherCount'), grossAgorot: l.get('grossAgorot'), commissionAgorot: l.get('commissionAgorot'), netAgorot: l.get('netAgorot') })),
  })
}

export async function POST(request: Request, { params }: { params: Promise<{ batchId: string }> }) {
  const authError = requireAdminAuth(request)
  if (authError) return authError
  const { batchId } = await params
  const body = await request.json().catch(() => null)
  if (!isDocumentId(batchId)) return NextResponse.json({ error: 'Invalid batch.' }, { status: 400 })
  try {
    if (body?.action === 'void') await voidPayoutBatch(getAdminDb(), request, batchId)
    else if (body?.action === 'paid') await markPayoutPaid(getAdminDb(), request, batchId)
    else return NextResponse.json({ error: 'Unknown action.' }, { status: 400 })
    return NextResponse.json({ ok: true })
  } catch (err) {
    if (err instanceof SettlementError) return NextResponse.json({ error: err.message }, { status: err.status })
    console.error('Payout action failed', err)
    return NextResponse.json({ error: 'The action failed.' }, { status: 500 })
  }
}

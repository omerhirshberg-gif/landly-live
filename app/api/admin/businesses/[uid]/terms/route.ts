import { NextResponse } from 'next/server'
import { requireAdminAuth } from '@/lib/admin/adminAuth'
import { writeAudit } from '@/lib/admin/auditLog'
import { getAdminDb } from '@/lib/firebase/admin'
import { isCommissionRate, isPaymentTerms, parseFrozenTerms } from '@/lib/merchants/terms'

// Sets the commission and payment terms agreed with a merchant (the offer wizard's
// second step). Orders and vouchers freeze the terms when they are made, so a change
// here only affects sales from now on. The merchant's signed agreement is untouched.
export async function PATCH(request: Request, { params }: { params: Promise<{ uid: string }> }) {
  const authError = requireAdminAuth(request)
  if (authError) return authError
  const { uid } = await params
  const body = await request.json().catch(() => null)
  if (!isCommissionRate(body?.commissionRate)) return NextResponse.json({ error: 'Commission must be between 0% and 50%.' }, { status: 400 })
  if (!isPaymentTerms(body?.paymentTerms)) return NextResponse.json({ error: 'Choose valid payment terms.' }, { status: 400 })
  const db = getAdminDb()
  const ref = db.collection('businesses').doc(uid)
  const snap = await ref.get()
  if (!snap.exists) return NextResponse.json({ error: 'Business not found.' }, { status: 404 })
  await ref.update({ commissionRate: body.commissionRate, paymentTerms: body.paymentTerms })
  await writeAudit(db, request, {
    action: 'business.terms', targetType: 'business', targetId: uid,
    before: parseFrozenTerms(snap.data()), after: { commissionRate: body.commissionRate, paymentTerms: body.paymentTerms },
  })
  return NextResponse.json({ ok: true })
}

import { NextResponse } from 'next/server'
import { Timestamp } from 'firebase-admin/firestore'
import { requireAdminAuth } from '@/lib/admin/adminAuth'
import { writeAudit } from '@/lib/admin/auditLog'
import { getAdminDb } from '@/lib/firebase/admin'
import { PRODUCTS_COLLECTION, SUPPLIERS_COLLECTION, isSupplierId } from '@/lib/inventory/ledger/types'
import { PaymentError, isDocumentId } from '@/lib/payments/paymentValidation'

// Creates a ledger product: one face value of a supplier (Raayonit 100 / 150 / 200 / 250 ILS, or a direct Multipass coupon tied to a
// businessId). Money in shekels in the request, agorot in storage. Face value is the id's meaning: one active product per
// (supplier, face value, business).
export async function POST(request: Request) {
  const denied = requireAdminAuth(request)
  if (denied) return denied
  const body = await request.json().catch(() => null)
  try {
    if (!body || !isSupplierId(body.supplierId)) throw new PaymentError('Choose a supplier.', 400)
    const agorot = (v: unknown, min: number) => { const n = Math.round(Number(v) * 100); if (!Number.isInteger(n) || n < min) throw new PaymentError('Enter valid amounts.', 400); return n }
    const face = agorot(body.faceValue, 100), price = agorot(body.price, 1), cost = agorot(body.cost ?? 0, 0)
    if (price > face) throw new PaymentError('The sale price cannot exceed the face value.', 400)
    const dynamic = body.supplierId === 'multipass' && body.issueMode === 'dynamic'
    const businessId = body.supplierId === 'multipass' ? body.businessId : null
    if (body.supplierId === 'multipass' && !isDocumentId(businessId)) throw new PaymentError('A Multipass product belongs to one business.', 400)
    const db = getAdminDb()
    const dup = await db.collection(PRODUCTS_COLLECTION).where('supplierId', '==', body.supplierId).where('faceValueAgorot', '==', face).get()
    if (dup.docs.some((d) => d.data().active !== false && (d.data().businessId ?? null) === (businessId ?? null))) throw new PaymentError('A product for this value already exists.', 409)
    const now = Timestamp.now()
    const ref = db.collection(PRODUCTS_COLLECTION).doc()
    await ref.create({
      supplierId: body.supplierId, title: String(body.title ?? '').trim().slice(0, 120) || `${body.supplierId} ${face / 100}`, businessId: businessId ?? null, faceValueAgorot: face, salePriceAgorot: price, costPriceAgorot: cost,
      validityDays: null, issueMode: dynamic ? 'dynamic' : 'stock', lowStockThreshold: Number.isInteger(body.lowStockThreshold) ? body.lowStockThreshold : 10, active: true, createdAt: now, updatedAt: now,
    })
    await db.collection(SUPPLIERS_COLLECTION).doc(body.supplierId).set({ name: body.supplierId === 'raayonit' ? 'Raayonit' : 'Multipass', active: true }, { merge: true })
    await writeAudit(db, request, { action: 'inventory.product.create', targetType: 'inventoryProduct', targetId: ref.id, after: { supplierId: body.supplierId, face, price } })
    return NextResponse.json({ id: ref.id })
  } catch (error) {
    if (error instanceof PaymentError) return NextResponse.json({ error: error.message }, { status: error.status })
    console.error('Product create failed')
    return NextResponse.json({ error: 'Could not create the product.' }, { status: 500 })
  }
}

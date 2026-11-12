import { NextResponse } from 'next/server'
import { Timestamp } from 'firebase-admin/firestore'
import { requireAdminAuth } from '@/lib/admin/adminAuth'
import { writeAudit } from '@/lib/admin/auditLog'
import { getAdminDb } from '@/lib/firebase/admin'
import { ADMIN_LIST_CAP } from '@/lib/admin/adminList'
import { createPool } from '@/lib/inventory/poolAdmin'
import { cipherKeyConfigured } from '@/lib/crypto/fieldCipher'
import { parseFulfillmentType, POOL_COLLECTION } from '@/lib/inventory/types'
import { PaymentError } from '@/lib/payments/paymentValidation'

const toIso = (value: unknown) => (value instanceof Timestamp ? value.toDate().toISOString() : null)

// The inventory page's data: every offer with how it is fulfilled, and the
// Multipass pools. Direct offers use the offer's own counters
// (totalQuantity null = unlimited, claimedCount sold so far).
export async function GET(request: Request) {
  const authError = requireAdminAuth(request)
  if (authError) return authError
  const db = getAdminDb()
  // Bounded, and only the fields shown (not whole offer documents).
  const [offersSnap, poolsSnap] = await Promise.all([
    db.collection('offers').select('title', 'businessName', 'fulfillmentType', 'poolId', 'totalQuantity', 'claimedCount').limit(ADMIN_LIST_CAP).get(),
    db.collection(POOL_COLLECTION).limit(ADMIN_LIST_CAP).get(),
  ])
  const pools = poolsSnap.docs.map((doc) => {
    const p = doc.data()
    return {
      poolId: doc.id, offerId: p.offerId, status: p.status, totalPurchased: p.totalPurchased, allocatedCount: p.allocatedCount,
      remainingCount: p.remainingCount, warningThreshold: p.warningThreshold, lowStock: !!p.lowStock,
      unitCost: p.unitCost, retailPrice: p.retailPrice, updatedAt: toIso(p.updatedAt),
    }
  })
  const offers = offersSnap.docs
    .map((doc) => {
      const o = doc.data()
      return {
        id: doc.id, title: o.title ?? '', businessName: o.businessName ?? '',
        fulfillmentType: parseFulfillmentType(o.fulfillmentType), poolId: typeof o.poolId === 'string' ? o.poolId : null,
        totalQuantity: typeof o.totalQuantity === 'number' ? o.totalQuantity : null, claimedCount: Number(o.claimedCount) || 0,
      }
    })
    .sort((a, b) => a.title.localeCompare(b.title))
  return NextResponse.json({ offers, pools, encryptionConfigured: cipherKeyConfigured('POOL_CODES_KEY') })
}

export async function POST(request: Request) {
  const authError = requireAdminAuth(request)
  if (authError) return authError
  const body = await request.json().catch(() => null)
  if (!body || typeof body.offerId !== 'string') return NextResponse.json({ error: 'Missing offerId.' }, { status: 400 })
  try {
    const db = getAdminDb()
    await createPool(db, {
      offerId: body.offerId, warningThreshold: Number(body.warningThreshold),
      unitCostAgorot: Math.round(Number(body.unitCost) * 100), retailPriceAgorot: Math.round(Number(body.retailPrice) * 100),
    })
    await writeAudit(db, request, { action: 'pool.create', targetType: 'pool', targetId: body.offerId, after: { warningThreshold: body.warningThreshold } })
    return NextResponse.json({ poolId: body.offerId })
  } catch (err) {
    if (err instanceof PaymentError) return NextResponse.json({ error: err.message }, { status: err.status })
    console.error('Pool creation failed', err)
    return NextResponse.json({ error: 'Could not create the pool.' }, { status: 500 })
  }
}

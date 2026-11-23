import { NextResponse } from 'next/server'
import { Timestamp } from 'firebase-admin/firestore'
import { requireAdminAuth } from '@/lib/admin/adminAuth'
import { writeAudit } from '@/lib/admin/auditLog'
import { getAdminDb } from '@/lib/firebase/admin'
import { ADMIN_LIST_CAP } from '@/lib/admin/adminList'
import { createSharedPool } from '@/lib/inventory/poolAdmin'
import { cipherKeyConfigured } from '@/lib/crypto/fieldCipher'
import { parseVariants } from '@/lib/offers/variants'
import { parseFulfillmentType, POOL_COLLECTION } from '@/lib/inventory/types'
import { PaymentError } from '@/lib/payments/paymentValidation'

const toIso = (value: unknown) => (value instanceof Timestamp ? value.toDate().toISOString() : null)

// The inventory page's data: every offer with how it is fulfilled, and the Raayonit
// voucher stocks. Direct offers use the offer's own counters
// (totalQuantity null = unlimited, claimedCount sold so far).
export async function GET(request: Request) {
  const authError = requireAdminAuth(request)
  if (authError) return authError
  const db = getAdminDb()
  // Bounded, and only the fields shown (not whole offer documents).
  const [offersSnap, poolsSnap] = await Promise.all([
    db.collection('offers').select('title', 'businessName', 'fulfillmentType', 'poolId', 'variants', 'totalQuantity', 'claimedCount').limit(ADMIN_LIST_CAP).get(),
    db.collection(POOL_COLLECTION).limit(ADMIN_LIST_CAP).get(),
  ])
  const pools = poolsSnap.docs.map((doc) => {
    const p = doc.data()
    return {
      poolId: doc.id, offerId: typeof p.offerId === 'string' ? p.offerId : null, title: typeof p.title === 'string' ? p.title : '',
      status: p.status, totalPurchased: p.totalPurchased, allocatedCount: p.allocatedCount,
      remainingCount: p.remainingCount, warningThreshold: p.warningThreshold, lowStock: !!p.lowStock,
      faceValueAgorot: Number.isInteger(p.faceValueAgorot) ? p.faceValueAgorot : null, priceAgorot: Number.isInteger(p.priceAgorot) ? p.priceAgorot : null,
      unitCost: p.unitCost, retailPrice: p.retailPrice, updatedAt: toIso(p.updatedAt),
    }
  })
  const offers = offersSnap.docs
    .map((doc) => {
      const o = doc.data()
      return {
        id: doc.id, title: o.title ?? '', businessName: o.businessName ?? '',
        fulfillmentType: parseFulfillmentType(o.fulfillmentType), poolId: typeof o.poolId === 'string' ? o.poolId : null,
        variantPoolIds: parseVariants(o.variants).map((v) => v.poolId),
        totalQuantity: typeof o.totalQuantity === 'number' ? o.totalQuantity : null, claimedCount: Number(o.claimedCount) || 0,
      }
    })
    .sort((a, b) => a.title.localeCompare(b.title))
  return NextResponse.json({ offers, pools, encryptionConfigured: cipherKeyConfigured('POOL_CODES_KEY') })
}

// Creates a stock of Raayonit vouchers of one face value; offers are linked to it when they are created or edited.
export async function POST(request: Request) {
  const authError = requireAdminAuth(request)
  if (authError) return authError
  const body = await request.json().catch(() => null)
  if (!body || typeof body.title !== 'string') return NextResponse.json({ error: 'Missing title.' }, { status: 400 })
  try {
    const db = getAdminDb()
    const input = {
      title: body.title, faceValueAgorot: Math.round(Number(body.faceValue) * 100), priceAgorot: Math.round(Number(body.price) * 100),
      warningThreshold: Number(body.warningThreshold ?? 10),
      // The wholesale cost is optional: 0 until the admin knows it.
      unitCostAgorot: body.unitCost === undefined || body.unitCost === '' || body.unitCost === null ? 0 : Math.round(Number(body.unitCost) * 100),
    }
    const poolId = await createSharedPool(db, input)
    await writeAudit(db, request, { action: 'pool.create', targetType: 'pool', targetId: poolId, after: { faceValueAgorot: input.faceValueAgorot, priceAgorot: input.priceAgorot, warningThreshold: input.warningThreshold } })
    return NextResponse.json({ poolId })
  } catch (err) {
    if (err instanceof PaymentError) return NextResponse.json({ error: err.message }, { status: err.status })
    console.error('Voucher stock creation failed', err)
    return NextResponse.json({ error: 'Could not create the voucher stock.' }, { status: 500 })
  }
}

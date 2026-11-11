import 'server-only'
import { Timestamp, type DocumentData, type DocumentReference, type DocumentSnapshot, type Firestore, type Transaction } from 'firebase-admin/firestore'
import { decryptField } from '@/lib/crypto/fieldCipher'
import { PaymentError } from '@/lib/payments/paymentValidation'
import { POOL_COLLECTION, poolItemId } from './types'

// How many expired codes one purchase may step over before it gives up.
const MAX_SKIPPED = 5

export interface PoolAllocationPlan {
  poolRef: DocumentReference
  itemRef: DocumentReference
  code: string
  nextSeq: number
  skipped: { ref: DocumentReference; seq: number }[]
  allocated: number
  remaining: number
  lowStock: boolean
  depleted: boolean
}

// Phase 1 of an allocation: reads only. claimOfferForOrder calls it before its
// first write, then applies the plan with applyPoolAllocation. The pool
// document is read here, so two buyers contending for the same code conflict
// and retry; one gets the code, the other the next one. A sold-out pool
// refuses the purchase (the payment then needs reconciliation, like any
// unavailable offer).
export async function planPoolAllocation(
  db: Firestore, tx: Transaction, poolId: string, offerId: string, orderId: string, now: Timestamp,
): Promise<PoolAllocationPlan> {
  const poolRef = db.collection(POOL_COLLECTION).doc(poolId)
  const poolSnap = await tx.get(poolRef)
  const pool = poolSnap.data()
  if (!poolSnap.exists || !pool || pool.offerId !== offerId || pool.status === 'archived') {
    throw new PaymentError('Offer inventory is unavailable; payment reconciliation is required.')
  }
  if (!Number.isInteger(pool.nextSeq) || !Number.isInteger(pool.lastSeq) || !Number.isInteger(pool.allocatedCount)
    || !Number.isInteger(pool.remainingCount)) {
    throw new PaymentError('Pool is inconsistent; reconciliation is required.')
  }
  const skipped: PoolAllocationPlan['skipped'] = []
  let seq: number = pool.nextSeq
  for (let step = 0; step <= MAX_SKIPPED && seq <= pool.lastSeq; step++, seq++) {
    const itemRef = poolRef.collection('items').doc(poolItemId(seq))
    const snap: DocumentSnapshot = await tx.get(itemRef)
    const item = snap.data()
    if (!item || item.status !== 'available') throw new PaymentError('Pool is inconsistent; reconciliation is required.')
    if (item.expiresAt instanceof Timestamp && item.expiresAt.toMillis() < now.toMillis()) {
      skipped.push({ ref: itemRef, seq })
      continue
    }
    const allocated = pool.allocatedCount + 1
    const remaining = pool.remainingCount - skipped.length - 1
    return {
      poolRef, itemRef, code: poolItemCode(poolId, seq, item),
      nextSeq: seq + 1, skipped, allocated, remaining: Math.max(0, remaining),
      lowStock: remaining <= (Number(pool.warningThreshold) || 0), depleted: remaining <= 0,
    }
  }
  throw new PaymentError('This offer is sold out; payment reconciliation is required.')
}

// The code a member sees: the code itself, with the supplier's PIN after it when the row had one.
function poolItemCode(poolId: string, seq: number, item: DocumentData) {
  const id = poolItemId(seq)
  const code = decryptField('POOL_CODES_KEY', item.codeCipher, `${poolId}/${id}`)
  return typeof item.pinCipher === 'string' ? `${code} · PIN ${decryptField('POOL_CODES_KEY', item.pinCipher, `${poolId}/${id}/pin`)}` : code
}

// Phase 2: writes only, inside the same transaction.
export function applyPoolAllocation(tx: Transaction, plan: PoolAllocationPlan, orderId: string, userId: string, now: Timestamp) {
  for (const { ref } of plan.skipped) tx.update(ref, { status: 'expired' })
  tx.update(plan.itemRef, { status: 'allocated', orderId, userId, allocatedAt: now })
  tx.update(plan.poolRef, {
    nextSeq: plan.nextSeq, allocatedCount: plan.allocated, remainingCount: plan.remaining,
    lowStock: plan.lowStock, status: plan.depleted ? 'depleted' : 'active', updatedAt: now,
  })
}

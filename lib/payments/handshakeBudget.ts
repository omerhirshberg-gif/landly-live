import 'server-only'
import type { Firestore } from 'firebase-admin/firestore'
import { PaymentError } from './paymentValidation'

// Each handshake is a paid-for call to Tranzila, so one order gets a handful (a retry after a decline, a refresh after the
// 20 minutes), not an unbounded number. The counter lives under orders/{id}/internal (Admin SDK only, firestore.rules).
export const MAX_HANDSHAKES_PER_ORDER = 8

export async function takeHandshake(db: Firestore, orderId: string): Promise<void> {
  const ref = db.collection('orders').doc(orderId).collection('internal').doc('handshakes')
  await db.runTransaction(async (tx) => {
    const count = (await tx.get(ref)).data()?.count
    const used = Number.isSafeInteger(count) && count >= 0 ? count : 0
    if (used >= MAX_HANDSHAKES_PER_ORDER) throw new PaymentError('Too many payment attempts for this order.', 429)
    tx.set(ref, { count: used + 1 })
  })
}

import 'server-only'
import type { DocumentReference, Firestore } from 'firebase-admin/firestore'

// What an order holds that no member may read: the merchant's commission and payment terms as frozen at checkout, the
// ledger code held for the order, and the place coordinates. `orders/{orderId}` is owner-readable (the checkout success page
// listens to it), and security rules cannot hide single fields, so these live in `orders/{orderId}/internal/terms`
// (`allow read, write: if false`, firestore.rules). Only the Admin SDK reads or writes it: initiateOrder, claimOfferForOrder,
// prepareLedgerSale and the member-hold count.
//
// Orders created before this split still carry the same fields on the order document itself; readers fall back to them
// (mergeOrderInternal) until scripts/migrate-order-internal.mts has moved them.
export interface OrderInternal {
  commissionRate: number | null
  paymentTerms: string | null
  reservedVoucherId: string | null
  businessGeo: unknown
}

export const ORDER_INTERNAL_KEYS = ['commissionRate', 'paymentTerms', 'reservedVoucherId', 'businessGeo'] as const

export const orderInternalRef = (db: Firestore, orderId: string): DocumentReference =>
  db.collection('orders').doc(orderId).collection('internal').doc('terms')

type Fields = Record<string, unknown> | undefined

/** The internal fields of an order: the internal document's when there is one, else the legacy ones on the order itself. */
export function mergeOrderInternal(order: Fields, internal: Fields): OrderInternal {
  const src = internal ?? order ?? {}
  return {
    commissionRate: typeof src.commissionRate === 'number' ? src.commissionRate : null,
    paymentTerms: typeof src.paymentTerms === 'string' ? src.paymentTerms : null,
    reservedVoucherId: typeof src.reservedVoucherId === 'string' && src.reservedVoucherId ? src.reservedVoucherId : null,
    businessGeo: src.businessGeo ?? null,
  }
}

export async function readOrderInternal(db: Firestore, orderId: string, order: Fields): Promise<OrderInternal> {
  return mergeOrderInternal(order, (await orderInternalRef(db, orderId).get()).data())
}

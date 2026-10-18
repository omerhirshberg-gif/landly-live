import { doc, getDoc, onSnapshot, Timestamp } from 'firebase/firestore'
import { db } from './config'

// refunded: a paid order cancelled through support (admin-set, Admin SDK only).
export type OrderStatus = 'pending' | 'paid' | 'failed' | 'refunded'

const STATUSES: readonly OrderStatus[] = ['pending', 'paid', 'failed', 'refunded']

export interface OrderDocument {
  userId: string
  offerId: string
  businessId: string
  businessName: string
  offerTitle: string
  amount: number // the price paid, VAT included
  // The offer's pre-discount price when the order was created; null for
  // orders that predate it (no discount line is shown then).
  originalPrice: number | null
  currency: 'ILS'
  status: OrderStatus
  paidAt: Date | null
  voucherId: string | null
}

function toDoc(data: Record<string, unknown>): OrderDocument {
  return {
    userId: (data.userId as string) ?? '',
    offerId: (data.offerId as string) ?? '',
    businessId: (data.businessId as string) ?? '',
    businessName: (data.businessName as string) ?? '',
    offerTitle: (data.offerTitle as string) ?? '',
    amount: Number(data.amount) || 0,
    originalPrice: typeof data.originalPrice === 'number' && data.originalPrice > 0 ? data.originalPrice : null,
    currency: 'ILS',
    status: STATUSES.includes(data.status as OrderStatus) ? (data.status as OrderStatus) : 'pending',
    paidAt: data.paidAt instanceof Timestamp ? data.paidAt.toDate() : null,
    voucherId: typeof data.voucherId === 'string' ? data.voucherId : null,
  }
}

// Orders are created and updated only via the Admin SDK (see
// app/api/payments/initiate and app/api/payments/tranzila-webhook) — this is
// a read-only live listener so the checkout success page can reflect
// payment confirmation as it happens, instead of trusting URL params.
export function subscribeToOrder(orderId: string, onChange: (order: OrderDocument | null) => void): () => void {
  return onSnapshot(
    doc(db, 'orders', orderId),
    (snap) => onChange(snap.exists() ? toDoc(snap.data()) : null),
    // A nonexistent orderId and someone else's order both deny-by-rule the
    // same way (permission-denied) — either way there's nothing to show but
    // "not found," so treat this identically to the doc not existing.
    () => onChange(null)
  )
}

/**
 * The member's own orders by id (a voucher's id is its order's id). One that
 * is missing or can't be read comes back null rather than failing the rest.
 */
export async function getOrdersByIds(orderIds: readonly string[]): Promise<(OrderDocument | null)[]> {
  return Promise.all(
    orderIds.map((id) =>
      getDoc(doc(db, 'orders', id)).then(
        (snap) => (snap.exists() ? toDoc(snap.data()) : null),
        () => null
      )
    )
  )
}

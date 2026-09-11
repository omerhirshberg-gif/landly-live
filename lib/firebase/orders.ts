import { doc, onSnapshot, Timestamp } from 'firebase/firestore'
import { db } from './config'

export type OrderStatus = 'pending' | 'paid' | 'failed'

export interface OrderDocument {
  userId: string
  offerId: string
  businessId: string
  businessName: string
  offerTitle: string
  amount: number
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
    currency: 'ILS',
    status: data.status === 'paid' ? 'paid' : data.status === 'failed' ? 'failed' : 'pending',
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

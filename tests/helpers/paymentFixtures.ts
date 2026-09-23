import { Timestamp } from 'firebase-admin/firestore'
import type { TranzilaNotification } from '@/lib/payments/parseTranzilaNotification'

export const terminal = 'landly_test'
export const offer = {
  businessId: 'business', businessName: 'Business', title: 'Offer', offerPrice: 10.25,
  totalQuantity: 10, claimedCount: 0, expiryDate: null,
}
export const business = { voucherStats: { active: 0 } }
export const pending = {
  userId: 'user', offerId: 'offer', businessId: 'business', businessName: 'Business', offerTitle: 'Offer',
  status: 'pending', amount: 10.25, amountAgorot: 1025, currency: 'ILS', terminal,
  paidAt: null, tranzilaTxnId: null, voucherId: null, createdAt: Timestamp.fromMillis(1000),
}
export const event: TranzilaNotification = {
  orderId: 'user_offer', terminal, tranzilaTxnId: '123', approved: true,
  responseCode: '000', amountAgorot: 1025, currency: 'ILS',
}
export const form = {
  orderId: event.orderId, supplier: terminal, index: '123', Response: '000',
  sum: '10.25', currency: '1', tranmode: 'A',
}
export function notification(overrides: Record<string, string> = {}) {
  return new Request('https://landly.test/api/payments/tranzila-webhook', {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'x-tranzila-webhook-secret': 'test-secret' },
    body: new URLSearchParams({ ...form, ...overrides }),
  })
}

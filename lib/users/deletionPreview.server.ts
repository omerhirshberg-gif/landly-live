import 'server-only'
import type { Firestore } from 'firebase-admin/firestore'
import type { Auth } from 'firebase-admin/auth'
import { Timestamp } from 'firebase-admin/firestore'
import { parseVoucherStatus } from '@/lib/vouchers/status'

// What the admin must see before permanently deleting a member: who it is,
// how many vouchers will be cancelled or kept (anonymised), and, above all,
// every PAID voucher still unredeemed. Those were paid for through Tranzila:
// deleting the account cancels them but refunds nothing, so the admin must
// have refunded them (or let the 14-day consumer-protection cancellation
// period pass) first. Read-only; the same numbers gate the delete itself.

export interface PaidActiveVoucher {
  voucherId: string
  /** The order number the member and support see (null on vouchers from before order numbering). */
  orderNumber: string | null
  /** The Tranzila transaction to refund, when the order records one. */
  tranzilaTxnId: string | null
  offerTitle: string
  businessName: string
  amountAgorot: number
  purchasedAt: string | null
}

export interface DeletionPreview {
  uid: string
  name: string
  email: string
  /** Signed in with Apple: Apple's token revocation happens on the member's device, not here. */
  appleLinked: boolean
  activeVouchers: number
  redeemedVouchers: number
  otherVouchers: number
  paidOrders: number
  paidActiveVouchers: PaidActiveVoucher[]
}

const iso = (value: unknown): string | null => (value instanceof Timestamp ? value.toDate().toISOString() : null)

export const isAppleLinked = (providerIds: readonly string[]): boolean => providerIds.includes('apple.com')

export async function loadDeletionPreview(db: Firestore, auth: Auth, uid: string): Promise<DeletionPreview | null> {
  const [userSnap, authUser, vouchers, orders] = await Promise.all([
    db.collection('users').doc(uid).get(),
    auth.getUser(uid).catch(() => null),
    db.collection('vouchers').where('userId', '==', uid).get(),
    db.collection('orders').where('userId', '==', uid).get(),
  ])
  if (!userSnap.exists && !authUser) return null
  const user = userSnap.data() ?? {}

  const orderByVoucher = new Map<string, FirebaseFirestore.QueryDocumentSnapshot>()
  let paidOrders = 0
  for (const order of orders.docs) {
    if (order.get('status') === 'paid') paidOrders += 1
    const voucherId = order.get('voucherId')
    if (typeof voucherId === 'string') orderByVoucher.set(voucherId, order)
  }

  let active = 0
  let redeemed = 0
  let other = 0
  const paidActive: PaidActiveVoucher[] = []
  for (const voucher of vouchers.docs) {
    const status = parseVoucherStatus(voucher.get('status'))
    if (status === 'active') {
      active += 1
      const amountAgorot = voucher.get('amountAgorot')
      if (typeof amountAgorot === 'number' && amountAgorot > 0) {
        const txn = orderByVoucher.get(voucher.id)?.get('tranzilaTxnId')
        paidActive.push({
          voucherId: voucher.id,
          orderNumber: typeof voucher.get('displayOrderNumber') === 'string' ? voucher.get('displayOrderNumber') : null,
          tranzilaTxnId: typeof txn === 'string' || typeof txn === 'number' ? String(txn) : null,
          offerTitle: String(voucher.get('offerTitle') ?? ''),
          businessName: String(voucher.get('businessName') ?? ''),
          amountAgorot,
          purchasedAt: iso(voucher.get('takenAt')),
        })
      }
    } else if (status === 'redeemed') redeemed += 1
    else other += 1
  }
  paidActive.sort((a, b) => (b.purchasedAt ?? '').localeCompare(a.purchasedAt ?? ''))

  return {
    uid,
    name: String(user.displayName || [user.firstName, user.lastName].filter(Boolean).join(' ') || ''),
    email: String(user.email ?? authUser?.email ?? ''),
    appleLinked: isAppleLinked(authUser?.providerData.map((p) => p.providerId) ?? []),
    activeVouchers: active,
    redeemedVouchers: redeemed,
    otherVouchers: other,
    paidOrders,
    paidActiveVouchers: paidActive,
  }
}

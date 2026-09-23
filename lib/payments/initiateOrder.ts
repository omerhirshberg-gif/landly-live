import 'server-only'
import { Firestore, Timestamp } from 'firebase-admin/firestore'
import { isOfferActive } from '@/lib/admin/offerStatus'
import { amountInAgorot, isDocumentId, PaymentError } from './paymentValidation'

export async function initiateOrder(db: Firestore, uid: string, offerId: string, terminal: string) {
  if (!isDocumentId(uid) || !isDocumentId(offerId) || !isDocumentId(`${uid}_${offerId}`)) {
    throw new PaymentError('Invalid offer or user ID.', 400)
  }
  const orderRef = db.collection('orders').doc(`${uid}_${offerId}`)
  const voucherRef = db.collection('vouchers').doc(orderRef.id)
  const offerRef = db.collection('offers').doc(offerId)

  return db.runTransaction(async (tx) => {
    const [orderSnap, voucherSnap, offerSnap, customerBusinessSnap] = await Promise.all([
      tx.get(orderRef), tx.get(voucherRef), tx.get(offerRef), tx.get(db.collection('businesses').doc(uid)),
    ])
    if (customerBusinessSnap.exists) throw new PaymentError('Business accounts cannot purchase customer offers.', 403)
    if (voucherSnap.exists) throw new PaymentError("You've already claimed this offer.")
    if (orderSnap.exists) {
      const order = orderSnap.data()!
      if (order.status !== 'pending' || order.userId !== uid || order.offerId !== offerId
        || order.terminal !== terminal || order.currency !== 'ILS'
        || order.tranzilaTxnId !== null || order.paidAt !== null || order.voucherId !== null
        || !isDocumentId(order.businessId) || !(order.createdAt instanceof Timestamp)) {
        throw new PaymentError('Existing order cannot be restarted; reconciliation is required.')
      }
      if (amountInAgorot(order.amount) !== order.amountAgorot) {
        throw new PaymentError('Existing order has inconsistent pricing; reconciliation is required.')
      }
      // A reload is an idempotent read, never a new payment attempt or reprice.
      return {
        orderId: orderRef.id, amount: order.amount, currency: 'ILS' as const,
        offerTitle: order.offerTitle, businessName: order.businessName,
      }
    }
    if (!offerSnap.exists) throw new PaymentError('Offer not found.', 404)
    const offer = offerSnap.data()!
    if ((offer.totalQuantity !== null && (!Number.isInteger(offer.totalQuantity) || offer.totalQuantity < 1))
      || !Number.isInteger(offer.claimedCount) || offer.claimedCount < 0
      || (offer.expiryDate !== null && !(offer.expiryDate instanceof Timestamp))) {
      throw new PaymentError('Offer has invalid availability data.')
    }
    if (!isOfferActive({
      totalQuantity: offer.totalQuantity, claimedCount: offer.claimedCount,
      expiryDate: offer.expiryDate?.toDate() ?? null,
    })) {
      throw new PaymentError('This offer is no longer available.')
    }
    if (!isDocumentId(offer.businessId)) throw new PaymentError('Offer has no valid business.')
    const business = await tx.get(db.collection('businesses').doc(offer.businessId))
    if (!business.exists) throw new PaymentError('Offer business no longer exists.')
    const amountAgorot = amountInAgorot(offer.offerPrice)
    const amount = amountAgorot / 100
    tx.create(orderRef, {
      userId: uid, offerId, businessId: offer.businessId,
      businessName: offer.businessName ?? '', offerTitle: offer.title ?? '',
      amount, amountAgorot, currency: 'ILS', terminal,
      status: 'pending', createdAt: Timestamp.now(),
      paidAt: null, tranzilaTxnId: null, voucherId: null,
    })
    return {
      orderId: orderRef.id, amount, currency: 'ILS' as const,
      offerTitle: offer.title ?? '', businessName: offer.businessName ?? '',
    }
  })
}

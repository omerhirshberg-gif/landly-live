import 'server-only'
import { createHash, randomInt } from 'node:crypto'
import { FieldValue, Firestore, Timestamp } from 'firebase-admin/firestore'
import type { TranzilaNotification } from './parseTranzilaNotification'
import { amountInAgorot, isDocumentId, PaymentError } from './paymentValidation'

function transactionKey(event: TranzilaNotification): string {
  return createHash('sha256').update(JSON.stringify([event.terminal, event.tranzilaTxnId])).digest('hex')
}

// The ledger stores only settlement fields, never the raw callback/card data.
// Every read precedes every write. Firestore retries this entire decision on
// contention; no email, network payment call, or other external effect belongs here.
export async function claimOfferForOrder(db: Firestore, event: TranzilaNotification) {
  const orderRef = db.collection('orders').doc(event.orderId)
  const receiptRef = db.collection('paymentTransactions').doc(transactionKey(event))
  return db.runTransaction(async (tx) => {
    const [orderSnap, receiptSnap] = await Promise.all([tx.get(orderRef), tx.get(receiptRef)])
    if (!orderSnap.exists) throw new PaymentError('Order not found.', 404)
    const order = orderSnap.data()!
    if (!isDocumentId(order.userId) || !isDocumentId(order.offerId) || !isDocumentId(order.businessId)
      || `${order.userId}_${order.offerId}` !== event.orderId
      || order.terminal !== event.terminal || order.currency !== event.currency
      || order.amountAgorot !== event.amountAgorot || amountInAgorot(order.amount) !== event.amountAgorot) {
      throw new PaymentError('Payment does not match the order; reconciliation is required.')
    }
    const voucherRef = db.collection('vouchers').doc(event.orderId)
    const voucherSnap = await tx.get(voucherRef)
    if (receiptSnap.exists) {
      const receipt = receiptSnap.data()!
      if (receipt.orderId !== event.orderId || receipt.terminal !== event.terminal
        || receipt.tranzilaTxnId !== event.tranzilaTxnId || receipt.amountAgorot !== event.amountAgorot
        || receipt.currency !== event.currency || receipt.responseCode !== event.responseCode
        || receipt.approved !== event.approved) {
        throw new PaymentError('Conflicting transaction replay; reconciliation is required.')
      }
      const voucher = voucherSnap.data()
      const consistent = event.approved
        ? order.status === 'paid' && order.voucherId === voucherRef.id && order.paidAt instanceof Timestamp
          && voucher?.userId === order.userId && voucher?.offerId === order.offerId
          && voucher?.businessId === order.businessId && voucher?.paymentTransactionKey === receiptRef.id
        : order.status === 'failed' && !voucherSnap.exists && order.paidAt === null && order.voucherId === null
      if (!consistent || order.tranzilaTxnId !== event.tranzilaTxnId) {
        throw new PaymentError('Inconsistent settled order; reconciliation is required.')
      }
      return { alreadyProcessed: true }
    }
    // Never overwrite a settled order, even for a different transaction ID.
    // Contradictory events and legacy partial settlements require manual review.
    if (order.status !== 'pending' || voucherSnap.exists || order.tranzilaTxnId !== null
      || order.paidAt !== null || order.voucherId !== null) {
      throw new PaymentError('Order is already settled or inconsistent; reconciliation is required.')
    }
    if (!event.approved) {
      tx.create(receiptRef, { ...event, processedAt: Timestamp.now() })
      tx.update(orderRef, { status: 'failed', tranzilaTxnId: event.tranzilaTxnId, responseCode: event.responseCode })
      return { alreadyProcessed: false }
    }
    const offerRef = db.collection('offers').doc(order.offerId)
    const businessRef = db.collection('businesses').doc(order.businessId)
    const [offerSnap, businessSnap] = await Promise.all([tx.get(offerRef), tx.get(businessRef)])
    if (!offerSnap.exists || !businessSnap.exists) {
      throw new PaymentError('Offer or business no longer exists; reconciliation is required.')
    }
    const offer = offerSnap.data()!
    if (offer.businessId !== order.businessId || !Number.isInteger(offer.claimedCount) || offer.claimedCount < 0
      || (offer.totalQuantity !== null && (!Number.isInteger(offer.totalQuantity) || offer.totalQuantity < 1))
      || (offer.expiryDate !== null && !(offer.expiryDate instanceof Timestamp))) {
      throw new PaymentError('Offer is inconsistent; reconciliation is required.')
    }
    if ((offer.totalQuantity !== null && offer.claimedCount >= offer.totalQuantity)
      || (offer.expiryDate && offer.expiryDate.toMillis() < Date.now())) {
      throw new PaymentError('Offer is unavailable; payment reconciliation is required.')
    }
    const now = Timestamp.now()
    tx.create(voucherRef, {
      userId: order.userId, offerId: order.offerId, businessId: order.businessId,
      businessName: order.businessName, offerTitle: order.offerTitle,
      redemptionCode: String(randomInt(0, 100_000_000)).padStart(8, '0'),
      status: 'active', takenAt: now, redeemedAt: null,
      paymentTransactionKey: receiptRef.id,
    })
    tx.update(offerRef, { claimedCount: FieldValue.increment(1) })
    tx.update(businessRef, { 'voucherStats.active': FieldValue.increment(1) })
    tx.update(orderRef, {
      status: 'paid', paidAt: now, tranzilaTxnId: event.tranzilaTxnId,
      responseCode: event.responseCode, voucherId: voucherRef.id,
    })
    tx.create(receiptRef, { ...event, processedAt: now })
    return { alreadyProcessed: false }
  })
}

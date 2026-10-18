import 'server-only'
import { type DocumentData, Firestore, Timestamp } from 'firebase-admin/firestore'
import { isOfferActive } from '@/lib/admin/offerStatus'
import { amountInAgorot, isDocumentId, PaymentError } from './paymentValidation'
import { normalizeRedemptionTerms, normalizeValidityDays } from './voucherTerms'
import { normalizeRedemptionInstructions, normalizeRedemptionMethod } from '../offers/redemption'

// Never paid and never issued a voucher: the only orders a sandbox may replace.
function isUnpaid(order: DocumentData, uid: string, offerId: string): boolean {
  return (order.status === 'pending' || order.status === 'failed')
    && order.userId === uid && order.offerId === offerId
    && order.paidAt === null && order.voucherId === null
}

// Same member, offer and terminal, still pending and untouched by any payment.
function isRestartable(order: DocumentData, uid: string, offerId: string, terminal: string): boolean {
  return order.status === 'pending' && order.userId === uid && order.offerId === offerId
    && order.terminal === terminal && order.currency === 'ILS'
    && order.tranzilaTxnId === null && order.paidAt === null && order.voucherId === null
    && isDocumentId(order.businessId) && order.createdAt instanceof Timestamp
}

// A reload of this exact pending order: same member, offer, terminal, consistent price.
function isResumable(order: DocumentData, uid: string, offerId: string, terminal: string): boolean {
  if (!isRestartable(order, uid, offerId, terminal)) return false
  try {
    return amountInAgorot(order.amount) === order.amountAgorot
  } catch {
    return false
  }
}

/** A stored pre-discount price, or null when there's none worth showing. */
function originalPriceOf(value: unknown, amount: number): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value > amount ? value : null
}

// The order freezes everything checkout shows (price, original price, voucher
// validity, redemption terms), so what the member agreed to is what the
// webhook issues even if the offer is edited meanwhile. `acceptTerms` comes
// from the Pay button, after the Terms/Refund checkbox: it stamps
// termsAcceptedAt once on the pending order and changes nothing else.
//
// `sandbox` is passed only for local dev sandbox orders (lib/payments/devSandbox.ts):
// an unpaid order that can't be resumed (a declined test payment, an older
// sandbox terminal), or any unpaid order when `restart` is set, is archived to
// supersededOrders and replaced. Without it, nothing is ever reopened.
export async function initiateOrder(
  db: Firestore,
  uid: string,
  offerId: string,
  terminal: string,
  { acceptTerms = false, sandbox }: { acceptTerms?: boolean; sandbox?: { restart: boolean } } = {}
) {
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
    const existing = orderSnap.exists ? orderSnap.data()! : null
    const superseded = existing && sandbox && isUnpaid(existing, uid, offerId)
      && (sandbox.restart || !isResumable(existing, uid, offerId, terminal))
      ? existing : null
    if (existing && !superseded) {
      const order = existing
      if (!isRestartable(order, uid, offerId, terminal)) {
        throw new PaymentError('Existing order cannot be restarted; reconciliation is required.')
      }
      if (amountInAgorot(order.amount) !== order.amountAgorot) {
        throw new PaymentError('Existing order has inconsistent pricing; reconciliation is required.')
      }
      // Orders created before validity/terms were frozen read them from the offer.
      const legacyOffer = offerSnap.exists ? offerSnap.data()! : {}
      const termsAccepted = order.termsAcceptedAt instanceof Timestamp
      if (acceptTerms && !termsAccepted) tx.update(orderRef, { termsAcceptedAt: Timestamp.now() })
      // A reload is an idempotent read, never a new payment attempt or reprice.
      return {
        orderId: orderRef.id, amount: order.amount, currency: 'ILS' as const,
        originalPrice: originalPriceOf(order.originalPrice, order.amount),
        offerTitle: order.offerTitle, businessName: order.businessName,
        validityDays: normalizeValidityDays(order.validityDays ?? legacyOffer.validityDays),
        redemptionTerms: normalizeRedemptionTerms(order.redemptionTerms ?? legacyOffer.redemptionTerms),
        termsAccepted: termsAccepted || acceptTerms,
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
    const originalPrice = originalPriceOf(offer.originalPrice, amount)
    const validityDays = normalizeValidityDays(offer.validityDays)
    const redemptionTerms = normalizeRedemptionTerms(offer.redemptionTerms)
    const redemptionMethod = normalizeRedemptionMethod(offer.redemptionMethod)
    const redemptionInstructions = normalizeRedemptionInstructions(offer.redemptionInstructions)
    const now = Timestamp.now()
    const newOrder = {
      userId: uid, offerId, businessId: offer.businessId,
      businessName: offer.businessName ?? '', offerTitle: offer.title ?? '',
      amount, amountAgorot, originalPrice, currency: 'ILS', terminal,
      validityDays, redemptionTerms, redemptionMethod, redemptionInstructions,
      status: 'pending', createdAt: now, termsAcceptedAt: acceptTerms ? now : null,
      paidAt: null, tranzilaTxnId: null, voucherId: null,
    }
    if (superseded) {
      tx.create(db.collection('supersededOrders').doc(`${orderRef.id}_${now.toMillis()}`), {
        ...superseded, orderId: orderRef.id, status: 'superseded', previousStatus: superseded.status, supersededAt: now,
      })
      // The order id is reused, so the replacement overwrites rather than merges.
      tx.set(orderRef, newOrder)
    } else {
      tx.create(orderRef, newOrder)
    }
    return {
      orderId: orderRef.id, amount, currency: 'ILS' as const, originalPrice,
      offerTitle: offer.title ?? '', businessName: offer.businessName ?? '',
      validityDays, redemptionTerms, termsAccepted: acceptTerms,
    }
  })
}

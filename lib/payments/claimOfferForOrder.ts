import 'server-only'
import { frozenPerkScope } from '../offers/perkScope'
import { createHash, randomBytes, randomInt } from 'node:crypto'
import { FieldValue, Firestore, Timestamp } from 'firebase-admin/firestore'
import type { TranzilaNotification } from './parseTranzilaNotification'
import { amountInAgorot, isDocumentId, PaymentError } from './paymentValidation'
import { isValidValidityDays, normalizeRedemptionTerms, normalizeValidityDays, voucherExpiresAtMs } from './voucherTerms'
import { isRedemptionMethod, normalizeRedemptionInstructions, normalizeRedemptionMethod } from '../offers/redemption'
import { applyPoolAllocation, planPoolAllocation } from '../inventory/poolAllocation'
import { parseFulfillmentType } from '../inventory/types'
import { parseFrozenTerms } from '../merchants/terms'
import { savingsAgorotOf } from '../member/savingsMath'
import { formatOrderNumber, ORDER_COUNTER_PATH, ORDER_SEQUENCE_START, ORDER_SHARD_COLLECTION, orderShardFor, shardedOrderNumber } from './orderNumber'

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
    // Only a local-business order names a business; a Multipass order carries its brand instead.
    const direct = parseFulfillmentType(order.fulfillmentType) === 'direct_merchant'
    if (!isDocumentId(order.userId) || !isDocumentId(order.offerId) || (direct && !isDocumentId(order.businessId))
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
          && (direct ? voucher?.businessId === order.businessId : voucher?.businessId === undefined) && voucher?.paymentTransactionKey === receiptRef.id
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
    const businessRef = direct ? db.collection('businesses').doc(order.businessId) : null
    // Legacy counter: read-only base. Shard doc: the only counter write, so
    // settlements contend one in ten instead of all on a single document.
    const legacyRef = db.collection(ORDER_COUNTER_PATH.collection).doc(ORDER_COUNTER_PATH.doc)
    const shard = orderShardFor(event.orderId)
    const shardRef = db.collection(ORDER_SHARD_COLLECTION).doc(String(shard))
    const [offerSnap, businessSnap, legacySnap, shardSnap] = await Promise.all([
      tx.get(offerRef), businessRef ? tx.get(businessRef) : Promise.resolve(null), tx.get(legacyRef), tx.get(shardRef),
    ])
    if (!offerSnap.exists || (businessRef && !businessSnap?.exists)) {
      throw new PaymentError('Offer or business no longer exists; reconciliation is required.')
    }
    // The shard is read in this transaction, so concurrent settlements on it
    // conflict and retry rather than share a number; a failed or declined
    // payment never consumes one.
    const legacyLast = legacySnap.exists ? legacySnap.data()!.orderSequence : ORDER_SEQUENCE_START
    const issued = shardSnap.exists ? shardSnap.data()!.count : 0
    if (!Number.isSafeInteger(legacyLast) || legacyLast < ORDER_SEQUENCE_START || !Number.isSafeInteger(issued) || issued < 0) {
      throw new PaymentError('Order counter is inconsistent; reconciliation is required.')
    }
    const orderNumber = shardedOrderNumber(legacyLast, issued, shard)
    const displayOrderNumber = formatOrderNumber(orderNumber)
    const offer = offerSnap.data()!
    if ((direct && offer.businessId !== order.businessId) || !Number.isInteger(offer.claimedCount) || offer.claimedCount < 0
      || (offer.totalQuantity !== null && (!Number.isInteger(offer.totalQuantity) || offer.totalQuantity < 1))
      || (offer.expiryDate !== null && !(offer.expiryDate instanceof Timestamp))) {
      throw new PaymentError('Offer is inconsistent; reconciliation is required.')
    }
    if ((offer.totalQuantity !== null && offer.claimedCount >= offer.totalQuantity)
      || (offer.expiryDate && offer.expiryDate.toMillis() < Date.now())) {
      throw new PaymentError('Offer is unavailable; payment reconciliation is required.')
    }
    const now = Timestamp.now()
    // Orders from before fulfillment types existed are direct-merchant sales.
    const fulfillmentType = parseFulfillmentType(order.fulfillmentType ?? offer.fulfillmentType)
    const poolId = isDocumentId(order.poolId) ? order.poolId : isDocumentId(offer.poolId) ? offer.poolId : null
    // All reads (the pool and its next code) happen before the first write below.
    const poolPlan = fulfillmentType === 'multipass_pool'
      ? await planPoolAllocation(db, tx, poolId ?? '', order.offerId, event.orderId, now) : null
    const terms = parseFrozenTerms(order) ?? (businessSnap ? parseFrozenTerms(businessSnap.data()) : null)
    // The terms frozen on the order at checkout; orders from before that read the offer's.
    const validityDays = isValidValidityDays(order.validityDays) ? order.validityDays : normalizeValidityDays(offer.validityDays)
    const redemptionTerms = normalizeRedemptionTerms(typeof order.redemptionTerms === 'string' ? order.redemptionTerms : offer.redemptionTerms)
    const redemptionMethod = isRedemptionMethod(order.redemptionMethod) ? order.redemptionMethod : normalizeRedemptionMethod(offer.redemptionMethod)
    const redemptionInstructions = normalizeRedemptionInstructions(
      typeof order.redemptionInstructions === 'string' ? order.redemptionInstructions : offer.redemptionInstructions,
    )
    tx.create(voucherRef, {
      userId: order.userId, offerId: order.offerId,
      ...(direct ? { businessId: order.businessId } : frozenPerkScope(order)),
      businessName: order.businessName, offerTitle: order.offerTitle,
      redemptionCode: String(randomInt(0, 100_000_000)).padStart(8, '0'),
      // What the QR code carries (lib/firebase/vouchers.ts redeemVoucherKey):
      // 128 random bits, unlike the voucher id, which anyone can derive.
      redeemToken: randomBytes(16).toString('hex'),
      status: 'active', takenAt: now, redeemedAt: null,
      expiresAt: Timestamp.fromMillis(voucherExpiresAtMs(now.toMillis(), validityDays)),
      redemptionTerms, redemptionMethod, redemptionInstructions,
      // The order's frozen copy; orders from before translations existed have none.
      translations: order.translations ?? null,
      businessTranslations: order.businessTranslations ?? null,
      businessAddress: order.businessAddress ?? null,
      businessGeo: order.businessGeo ?? null,
      paymentTransactionKey: receiptRef.id,
      orderNumber, displayOrderNumber,
      // Settlement reads only these: the terms and price as sold, and which batch (if any) paid it out.
      fulfillmentType, amountAgorot: event.amountAgorot,
      // What the member saved (original price minus paid), so the wallet total needs no order reads.
      savingsAgorot: savingsAgorotOf(order.originalPrice, event.amountAgorot),
      commissionRate: terms?.commissionRate ?? null, paymentTerms: terms?.paymentTerms ?? null,
      payoutBatchId: null,
      // A Multipass code is the member's entitlement, so the voucher (owner-readable) carries it.
      externalCode: poolPlan?.code ?? null,
    })
    if (poolPlan) applyPoolAllocation(tx, poolPlan, event.orderId, order.userId, now)
    tx.set(shardRef, { count: issued + 1 })
    tx.update(offerRef, { claimedCount: FieldValue.increment(1) })
    // No business voucherStats write here: that doc is shared by every perk a
    // merchant sells, so the active count is counted on read instead
    // (app/api/business/vouchers?count=1).
    tx.update(orderRef, {
      status: 'paid', paidAt: now, tranzilaTxnId: event.tranzilaTxnId,
      responseCode: event.responseCode, voucherId: voucherRef.id,
      orderNumber, displayOrderNumber,
    })
    tx.create(receiptRef, { ...event, processedAt: now })
    return { alreadyProcessed: false }
  })
}

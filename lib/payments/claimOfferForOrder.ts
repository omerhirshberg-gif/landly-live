import { normalizeWebsiteUrl, parsePhones } from '@/lib/offers/contact'
import { orderIdMatches } from '../offers/variants'
import 'server-only'
import { belongsToBusiness, frozenNationwide, frozenPerkScope } from '../offers/perkScope'
import { createHash, randomBytes, randomInt } from 'node:crypto'
import { FieldValue, Firestore, Timestamp } from 'firebase-admin/firestore'
import type { TranzilaNotification } from './parseTranzilaNotification'
import { amountInAgorot, isDocumentId, PaymentError } from './paymentValidation'
import { addYearsEndOfIsraelDayMs, isValidValidityDays, normalizeRedemptionTerms, normalizeValidityDays, voucherExpiresAtMs } from './voucherTerms'
import { RAAYONIT_ISSUER, RAAYONIT_VALIDITY_YEARS } from './issuer'
import { isRedemptionMethod, normalizeRedemptionInstructions, normalizeRedemptionMethod } from '../offers/redemption'
import { applyPoolAllocation, planPoolAllocation } from '../inventory/poolAllocation'
import { applySettlement, pickCandidates, planSettlement, releaseReservation, type SettlementPlan } from '../inventory/ledger/stock'
import { decryptVoucherCode, hashCode } from '../inventory/ledger/codes'
import { issuedVoucherPlan } from '../inventory/ledger/transitions'
import { prepareLedgerSale } from '../inventory/ledger/prepareSale'
import { DEV_SANDBOX_TERMINAL } from './devSandbox'
import { parseFulfillmentType } from '../inventory/types'
import { parseFrozenTerms } from '../merchants/terms'
import { savingsAgorotOf } from '../member/savingsMath'
import { mergeOrderInternal, orderInternalRef } from './orderInternal'
import { formatOrderNumber, ORDER_COUNTER_PATH, ORDER_SEQUENCE_START, ORDER_SHARD_COLLECTION, orderShardFor, shardedOrderNumber } from './orderNumber'

function transactionKey(event: TranzilaNotification): string {
  return createHash('sha256').update(JSON.stringify([event.terminal, event.tranzilaTxnId])).digest('hex')
}

// A decline on a real terminal is an attempt, not the end of the order: the member retries with another card or wallet, so
// the order stays `pending` (its code stays held) and the declined attempt is kept as an audit receipt. The dev sandbox keeps
// its terminal `failed` order (initiateOrder replaces it), and so does any approved-then-contradicted record (reconciliation).
export const isRetryableDecline = (event: TranzilaNotification, orderTerminal: unknown): boolean =>
  !event.approved && orderTerminal !== DEV_SANDBOX_TERMINAL

// The ledger stores only settlement fields, never the raw callback/card data.
// Every read precedes every write. Firestore retries this entire decision on
// contention; no email, network payment call, or other external effect belongs here.
export async function claimOfferForOrder(db: Firestore, event: TranzilaNotification) {
  const orderRef = db.collection('orders').doc(event.orderId)
  const receiptRef = db.collection('paymentTransactions').doc(transactionKey(event))
  // Before the transaction: what the ledger needs that must not run inside a retryable transaction (a supplier call, a stock query).
  const pre = event.approved ? await prepareLedgerSale(db, event.orderId) : null
  const outcome = await db.runTransaction(async (tx) => {
    const [orderSnap, receiptSnap, internalSnap] = await Promise.all([tx.get(orderRef), tx.get(receiptRef), tx.get(orderInternalRef(db, event.orderId))])
    if (!orderSnap.exists) throw new PaymentError('Order not found.', 404)
    const order = orderSnap.data()!
    // Only a local-business order names a business; a Raayonit order and a manual multi-chain pass carry their brand instead.
    const direct = belongsToBusiness(order)
    if (!isDocumentId(order.userId) || !isDocumentId(order.offerId) || (direct && !isDocumentId(order.businessId))
      || !orderIdMatches(event.orderId, order)
      || order.terminal !== event.terminal || order.currency !== event.currency
      || order.amountAgorot !== event.amountAgorot || amountInAgorot(order.amount) !== event.amountAgorot) {
      throw new PaymentError('Payment does not match the order; reconciliation is required.')
    }
    const voucherRef = db.collection('vouchers').doc(event.orderId)
    const voucherSnap = await tx.get(voucherRef)
    const retryable = isRetryableDecline(event, order.terminal)
    if (receiptSnap.exists) {
      const receipt = receiptSnap.data()!
      if (receipt.orderId !== event.orderId || receipt.terminal !== event.terminal
        || receipt.tranzilaTxnId !== event.tranzilaTxnId || receipt.amountAgorot !== event.amountAgorot
        || receipt.currency !== event.currency || receipt.responseCode !== event.responseCode
        || receipt.approved !== event.approved) {
        throw new PaymentError('Conflicting transaction replay; reconciliation is required.')
      }
      const voucher = voucherSnap.data()
      // A retryable decline leaves the order pending (or, if a later attempt was approved, paid by another transaction).
      const consistent = retryable
        ? !voucherSnap.exists && order.voucherId === null && order.paidAt === null && order.status === 'pending'
          || (order.status === 'paid' && order.tranzilaTxnId !== event.tranzilaTxnId && order.voucherId === voucherRef.id)
        : event.approved
        ? order.status === 'paid' && order.voucherId === voucherRef.id && order.paidAt instanceof Timestamp
          && voucher?.userId === order.userId && voucher?.offerId === order.offerId
          && (direct ? voucher?.businessId === order.businessId : voucher?.businessId === undefined) && voucher?.paymentTransactionKey === receiptRef.id
        : order.status === 'failed' && !voucherSnap.exists && order.paidAt === null && order.voucherId === null
      if (!consistent || (!retryable && order.tranzilaTxnId !== event.tranzilaTxnId)) {
        throw new PaymentError('Inconsistent settled order; reconciliation is required.')
      }
      return retryable ? { alreadyProcessed: true, retryable } : { alreadyProcessed: true }
    }
    // A decline that arrives after another attempt was approved: keep it as a receipt, change nothing else.
    if (retryable && order.status === 'paid' && voucherSnap.exists && order.tranzilaTxnId !== event.tranzilaTxnId) {
      tx.create(receiptRef, { ...event, processedAt: Timestamp.now() })
      return retryable ? { alreadyProcessed: true, retryable } : { alreadyProcessed: true }
    }
    // Never overwrite a settled order, even for a different transaction ID.
    // Contradictory events and legacy partial settlements require manual review.
    if (order.status !== 'pending' || voucherSnap.exists || order.tranzilaTxnId !== null
      || order.paidAt !== null || order.voucherId !== null) {
      throw new PaymentError('Order is already settled or inconsistent; reconciliation is required.')
    }
    if (retryable) {
      tx.create(receiptRef, { ...event, processedAt: Timestamp.now() })
      // The order stays pending and untouched by any payment (tranzilaTxnId null), so it can be restarted; only the last answer is noted.
      tx.update(orderRef, { responseCode: event.responseCode })
      return retryable ? { alreadyProcessed: false, retryable } : { alreadyProcessed: false }
    }
    if (!event.approved) {
      tx.create(receiptRef, { ...event, processedAt: Timestamp.now() })
      tx.update(orderRef, { status: 'failed', tranzilaTxnId: event.tranzilaTxnId, responseCode: event.responseCode })
      return retryable ? { alreadyProcessed: false, retryable } : { alreadyProcessed: false }
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
    // A product that lives in the ledger sells through RESERVED -> SOLD -> DELIVERED; an older pool still allocates by sequence.
    const ledgerStock = pre?.kind === 'stock' ? pre : null
    const poolPlan = fulfillmentType === 'raayonit_pool' && !ledgerStock
      ? await planPoolAllocation(db, tx, poolId ?? '', order.offerId, event.orderId, now) : null
    const ledgerPlan: SettlementPlan | null = ledgerStock
      ? await planSettlement(db, tx, ledgerStock.productId, event.orderId, ledgerStock.reservedId, ledgerStock.fallbackIds, now, voucherRef.id) : null
    const ledgerCode = ledgerPlan ? decryptVoucherCode(ledgerPlan.code.cipher, ledgerPlan.voucherRef.id) : null
    const issuedSale = pre?.kind === 'issued' ? pre : null
    const issuedPlan = issuedSale ? issuedVoucherPlan(db, {
      productId: issuedSale.productId, supplierId: issuedSale.supplierId, codeEncrypted: issuedSale.codeEncrypted, codeHash: hashCode(issuedSale.code), faceValueAgorot: issuedSale.faceValueAgorot,
      supplierRef: issuedSale.supplierRef, expiresAt: issuedSale.expiresAt ? Timestamp.fromDate(issuedSale.expiresAt) : null, orderId: event.orderId, walletVoucherId: voucherRef.id,
      businessId: direct ? order.businessId : null, externalId: issuedSale.externalEventId,
    }, now) : null
    const ledgerFaceValue = ledgerPlan?.voucher.faceValueAgorot ?? null
    // The commission terms and place frozen at checkout sit on the server-only internal document (older orders: on the order itself).
    const internal = mergeOrderInternal(order, internalSnap.data())
    const terms = parseFrozenTerms(internal) ?? (businessSnap ? parseFrozenTerms(businessSnap.data()) : null)
    // The terms frozen on the order at checkout; orders from before that read the offer's.
    const validityDays = isValidValidityDays(order.validityDays) ? order.validityDays : normalizeValidityDays(offer.validityDays)
    const redemptionTerms = normalizeRedemptionTerms(typeof order.redemptionTerms === 'string' ? order.redemptionTerms : offer.redemptionTerms)
    const redemptionMethod = isRedemptionMethod(order.redemptionMethod) ? order.redemptionMethod : normalizeRedemptionMethod(offer.redemptionMethod)
    const redemptionInstructions = normalizeRedemptionInstructions(
      typeof order.redemptionInstructions === 'string' ? order.redemptionInstructions : offer.redemptionInstructions,
    )
    tx.create(voucherRef, {
      userId: order.userId, offerId: order.offerId,
      ...(direct ? { businessId: order.businessId, ...frozenNationwide(order) } : frozenPerkScope(order)),
      businessName: order.businessName, offerTitle: order.offerTitle,
      redemptionCode: String(randomInt(0, 100_000_000)).padStart(8, '0'),
      // What the QR code carries (lib/firebase/vouchers.ts redeemVoucherKey):
      // 128 random bits, unlike the voucher id, which anyone can derive.
      redeemToken: randomBytes(16).toString('hex'),
      status: 'active', takenAt: now, redeemedAt: null,
      // A Raayonit voucher lasts 5 calendar years from the moment of purchase; any other, the offer's validity days.
      expiresAt: ledgerPlan?.voucher.expiresAt ?? issuedPlan?.data.expiresAt ?? Timestamp.fromMillis(poolPlan
        ? addYearsEndOfIsraelDayMs(now.toMillis(), RAAYONIT_VALIDITY_YEARS)
        : voucherExpiresAtMs(now.toMillis(), validityDays)),
      redemptionTerms, redemptionMethod, redemptionInstructions,
      // The order's frozen copy; orders from before translations existed have none.
      translations: order.translations ?? null,
      businessTranslations: order.businessTranslations ?? null,
      // The business's website and phone as at purchase (a Raayonit brand), so the voucher keeps them whatever the card later says.
      ...(normalizeWebsiteUrl(offer.websiteUrl) ? { websiteUrl: normalizeWebsiteUrl(offer.websiteUrl) } : {}),
      ...(parsePhones(offer.contactPhone).length > 0 ? { contactPhone: String(offer.contactPhone).trim() } : {}),
      businessAddress: order.businessAddress ?? null,
      businessGeo: internal.businessGeo ?? null,
      paymentTransactionKey: receiptRef.id,
      orderNumber, displayOrderNumber,
      // Settlement reads only these: the terms and price as sold, and which batch (if any) paid it out.
      fulfillmentType, amountAgorot: event.amountAgorot,
      // What the member saved (original price minus paid), so the wallet total needs no order reads.
      savingsAgorot: savingsAgorotOf(order.originalPrice, event.amountAgorot),
      commissionRate: terms?.commissionRate ?? null, paymentTerms: terms?.paymentTerms ?? null,
      payoutBatchId: null,
      // A Raayonit code is the member's entitlement, so the voucher (owner-readable) carries it.
      externalCode: poolPlan?.code ?? ledgerCode ?? issuedSale?.code ?? null,
      // The ledger document behind the code (absent on a voucher sold from an older pool).
      ...(ledgerPlan || issuedPlan ? { inventoryVoucherId: ledgerPlan?.voucherRef.id ?? issuedPlan!.ref.id } : {}),
      // A Raayonit voucher is a code and nothing else (no QR code): who issued it and what it is worth, frozen with the sale.
      ...(poolPlan || ledgerPlan ? { redemptionKind: 'code_only', issuer: RAAYONIT_ISSUER, faceValueAgorot: poolPlan?.faceValueAgorot ?? ledgerFaceValue, poolId } : {}),
    })
    if (poolPlan) applyPoolAllocation(tx, poolPlan, event.orderId, order.userId, now)
    if (ledgerPlan) applySettlement(db, tx, ledgerPlan, now)
    if (issuedPlan) {
      // Issued at the sale by the supplier: the voucher is born DELIVERED, with its ISSUED / SOLD / DELIVERED events, in this transaction.
      tx.create(issuedPlan.ref, issuedPlan.data)
      for (const e of issuedPlan.events) tx.create(e.ref, e.data)
    }
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
    return retryable ? { alreadyProcessed: false, retryable } : { alreadyProcessed: false }
  })
  // A final decline frees the code its checkout was holding (the 5-minute cron frees any this misses); a retryable one keeps it for the next attempt.
  if (!event.approved && !outcome.alreadyProcessed && !outcome.retryable) await releaseReservation(db, event.orderId).catch(() => 0)
  return outcome
}


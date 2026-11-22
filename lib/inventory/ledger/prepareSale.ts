import 'server-only'
import type { DocumentData, Firestore } from 'firebase-admin/firestore'
import { PaymentError, isDocumentId } from '@/lib/payments/paymentValidation'
import { findVariant, parseVariants } from '@/lib/offers/variants'
import { getSupplierAdapter } from '../suppliers'
import { SupplierNotConfiguredError } from '../suppliers/SupplierAdapter'
import { trackSupplierCall } from './alerts'
import { encryptVoucherCode, hashCode } from './codes'
import { pickCandidates } from './stock'
import { PRODUCTS_COLLECTION, type SupplierId } from './types'

// Work that must happen around the settlement transaction, not inside it (Firestore may retry that transaction, and a supplier
// call is an external effect):
//   resolveLedgerProduct   at checkout: which ledger product (if any) an offer sells, and how it is fulfilled
//   prepareLedgerSale      just before settlement: a pre-stocked code's candidates, or the supplier's issuance for a dynamic product

export interface LedgerProduct { productId: string; mode: 'stock' | 'dynamic'; supplierId: SupplierId; faceValueAgorot: number; businessId: string | null }

/** The ledger product behind an offer's chosen variant, or null when the offer still sells from an older pool / has none. */
export async function resolveLedgerProduct(db: Firestore, offer: DocumentData | undefined, variantPoolId: string | null): Promise<LedgerProduct | null> {
  if (!offer) return null
  const variant = findVariant(parseVariants(offer.variants), variantPoolId)
  const candidate = offer.fulfillmentType === 'raayonit_pool' ? (variant ? variant.poolId : offer.poolId) : offer.inventoryProductId
  if (!isDocumentId(candidate)) return null
  const snap = await db.collection(PRODUCTS_COLLECTION).doc(candidate).get()
  const p = snap.data()
  if (!p || p.active === false) return null
  return { productId: snap.id, mode: p.issueMode === 'dynamic' ? 'dynamic' : 'stock', supplierId: p.supplierId === 'multipass' ? 'multipass' : 'raayonit', faceValueAgorot: p.faceValueAgorot, businessId: typeof p.businessId === 'string' ? p.businessId : null }
}

export type LedgerSalePrep =
  | { kind: 'stock'; productId: string; reservedId: string | null; fallbackIds: string[] }
  | { kind: 'issued'; productId: string; supplierId: SupplierId; code: string; codeEncrypted: string; supplierRef: string; expiresAt: Date | null; faceValueAgorot: number; externalEventId: string }
  | null

/** Null for an order the ledger does not serve (the transaction then follows the older path or refuses it itself). */
export async function prepareLedgerSale(db: Firestore, orderId: string): Promise<LedgerSalePrep> {
  const order = (await db.collection('orders').doc(orderId).get()).data()
  if (!order || order.status !== 'pending') return null
  const productId = isDocumentId(order.inventoryProductId) ? order.inventoryProductId : order.fulfillmentType === 'raayonit_pool' && isDocumentId(order.poolId) ? order.poolId : null
  if (!productId) return null
  const p = (await db.collection(PRODUCTS_COLLECTION).doc(productId).get()).data()
  if (!p) return null
  if (p.issueMode !== 'dynamic') {
    return { kind: 'stock', productId, reservedId: typeof order.reservedVoucherId === 'string' ? order.reservedVoucherId : null, fallbackIds: await pickCandidates(db, productId, 3) }
  }
  const supplierId: SupplierId = p.supplierId === 'multipass' ? 'multipass' : 'raayonit'
  const externalEventId = `order:${orderId}`
  try {
    const adapter = getSupplierAdapter(supplierId)
    const out = await trackSupplierCall(db, supplierId, () => adapter.issue({ orderId, productId, faceValueAgorot: p.faceValueAgorot, businessId: typeof p.businessId === 'string' ? p.businessId : null, externalEventId }))
    return { kind: 'issued', productId, supplierId, code: out.code, codeEncrypted: encryptVoucherCode(out.code, hashCode(out.code)), supplierRef: out.supplierRef, expiresAt: out.expiresAt ?? null, faceValueAgorot: p.faceValueAgorot, externalEventId }
  } catch (error) {
    // The message names no code; the payment then needs reconciliation and the gateway retries (the issue call is idempotent).
    if (error instanceof SupplierNotConfiguredError) throw new PaymentError('The voucher supplier is not available; payment reconciliation is required.')
    throw new PaymentError('The supplier could not issue the voucher; payment reconciliation is required.')
  }
}

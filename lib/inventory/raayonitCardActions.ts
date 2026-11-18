import 'server-only'
import { FieldValue, Timestamp, type Firestore } from 'firebase-admin/firestore'
import { ARCHIVED_REASON } from './raayonitCardTabs'

// The admin's changes to one stored Raayonit card, as the exact fields to write. Pure apart from the timestamps, so the
// API routes and the tests share them.

type Data = Record<string, unknown>

/**
 * Bring an archived partner back: live again under its original `raayonit:{key}`, every archive field cleared, and `restoredAt` set so the
 * nightly sync does not archive it again while Raayonit still does not list it. Null when the card is not one the sync archived.
 */
export function restoreFields(card: Data): Data | null {
  const key = card.archivedSourceKey
  if (card.archivedReason !== ARCHIVED_REASON || typeof key !== 'string' || !/^raayonit:[^:]+$/.test(key)) return null
  return {
    published: true, raayonitSyncPending: false, sourceKey: key,
    archivedReason: FieldValue.delete(), archivedAt: FieldValue.delete(), archivedSourceKey: FieldValue.delete(), retiredAt: FieldValue.delete(), retiredReason: FieldValue.delete(),
    restoredAt: Timestamp.now(), restoredBy: 'admin',
  }
}

/** A card superseded by another (an old per-stock duplicate): it has no `raayonit:` key to come back to, so it is never republished. */
export const isSuperseded = (card: Data): boolean => String(card.sourceKey ?? '').startsWith('retired:') && card.archivedReason !== ARCHIVED_REASON

/**
 * What publishing a card on the site writes: an archived card goes through restoreFields (so the archive metadata and its `retired:` key are
 * always cleaned up); a draft, a hidden or a rejected card just goes live. Null for a superseded card.
 */
export function publishFields(card: Data): Data | null {
  if (card.archivedReason === ARCHIVED_REASON) return restoreFields(card)
  if (isSuperseded(card)) return null
  return { published: true, raayonitSyncPending: false, pendingSince: FieldValue.delete(), reviewRejectedAt: FieldValue.delete() }
}

/** True when an order or a voucher still points at the card, so deleting it would erase the record of what was sold. */
export async function hasOrdersOrVouchers(db: Firestore, offerId: string): Promise<boolean> {
  const [order, voucher] = await Promise.all([
    db.collection('orders').where('offerId', '==', offerId).limit(1).get(),
    db.collection('vouchers').where('offerId', '==', offerId).limit(1).get(),
  ])
  return !order.empty || !voucher.empty
}

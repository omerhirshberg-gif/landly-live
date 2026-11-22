import 'server-only'
import { Timestamp, type Firestore } from 'firebase-admin/firestore'
import { PaymentError } from '@/lib/payments/paymentValidation'
import { syncRaayonitCatalog, type SnapshotBrand, type TranslateBatch } from '../raayonitCatalogSync'
import { BUSINESS_CHANGES_COLLECTION } from './types'

export const ARCHIVED_REASON = 'removed_from_raayonit_catalog'

export interface ApprovalDeps {
  origin?: string
  translateBatch?: TranslateBatch
  /** Tests and the admin route may swap the catalogue writer. */
  apply?: typeof syncRaayonitCatalog
}

/**
 * Applies ONE recorded change to the storefront. Refuses while Raayonit display is off (the caller passes the flag, resolved
 * by isRaayonitDisplayEnabled()), so nothing Raayonit-branded can go live before their written approval.
 */
export async function approveBusinessChange(db: Firestore, changeId: string, actor: string, displayEnabled: boolean, deps: ApprovalDeps = {}): Promise<{ applied: 'published' | 'staged' | 'archived' | 'acknowledged' }> {
  if (!displayEnabled) throw new PaymentError('Raayonit display is switched off, so changes cannot go live. Enable the flag first.', 409)
  const ref = db.collection(BUSINESS_CHANGES_COLLECTION).doc(changeId)
  const snap = await ref.get()
  if (!snap.exists) throw new PaymentError('Change not found.', 404)
  const change = snap.data()!
  if (change.status !== 'pending') throw new PaymentError('This change was already decided.', 409)
  const now = Timestamp.now()
  let applied: 'published' | 'staged' | 'archived' | 'acknowledged' = 'acknowledged'
  if (change.kind === 'added' && change.payload?.brand) {
    const brand = change.payload.brand as SnapshotBrand
    const reuse = typeof change.payload.reuseOfferId === 'string' ? new Map([[brand.key, change.payload.reuseOfferId as string]]) : undefined
    const known = change.payload.known === true
    const later: (() => Promise<void>)[] = []
    await (deps.apply ?? syncRaayonitCatalog)(db, {
      brands: [brand], origin: deps.origin ?? 'https://golandly.com', translateBatch: deps.translateBatch, after: (t) => { later.push(t) },
      partial: { decide: () => (known ? { published: true, pending: false } : { published: false, pending: true }), reuse },
    })
    for (const t of later) await t()
    applied = known ? 'published' : 'staged'
  } else if (change.kind === 'removed' && typeof change.payload?.offerId === 'string') {
    const offerId = change.payload.offerId as string
    await db.collection('offers').doc(offerId).update({
      published: false, raayonitSyncPending: false, archivedReason: ARCHIVED_REASON, archivedAt: now, archivedSourceKey: change.payload.sourceKey ?? '',
      sourceKey: `retired:${offerId}`, retiredAt: now, retiredReason: 'not in the Raayonit catalogue',
    })
    applied = 'archived'
  }
  await ref.update({ status: 'approved', decidedAt: now, decidedBy: actor })
  return { applied }
}

export async function dismissBusinessChange(db: Firestore, changeId: string, actor: string): Promise<void> {
  const ref = db.collection(BUSINESS_CHANGES_COLLECTION).doc(changeId)
  const snap = await ref.get()
  if (!snap.exists) throw new PaymentError('Change not found.', 404)
  if (snap.data()!.status !== 'pending') throw new PaymentError('This change was already decided.', 409)
  await ref.update({ status: 'dismissed', decidedAt: Timestamp.now(), decidedBy: actor })
}

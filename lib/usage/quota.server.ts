import 'server-only'
import { FieldValue, Timestamp, type Firestore } from 'firebase-admin/firestore'
import { auditInTransaction } from '@/lib/admin/auditLog'
import { QUOTA_FIELD, quotaOf, type QuotaChannel } from './quota'
import { QUOTA_DOC_ID, TOPUP_AMOUNT, USAGE_COLLECTION } from './usageTypes'

export type TopUpResult =
  | { ok: true; quota: number }
  | { ok: false; reason: 'stale'; quota: number }
  | { ok: false; reason: 'project'; quota?: undefined }

/**
 * Adds TOPUP_AMOUNT to one channel's purchased quota, atomically. `from` is
 * the quota the admin saw: when it is no longer the stored one (a double
 * click, a second admin) nothing is added and the current value comes back.
 * A missing document or field counts as the default, so the first top-up is
 * 1,000 -> 2,000, not 0 -> 1,000. Goes through getAdminDb() (DEV or PROD,
 * lib/firebase/envGuard.ts); a document that names another project is refused.
 */
export async function topUpQuota(db: Firestore, request: Request, projectId: string, channel: QuotaChannel, from: number): Promise<TopUpResult> {
  const ref = db.collection(USAGE_COLLECTION).doc(QUOTA_DOC_ID)
  const field = QUOTA_FIELD[channel]
  return db.runTransaction(async (tx): Promise<TopUpResult> => {
    const snap = await tx.get(ref)
    const data = snap.exists ? snap.data() : undefined
    if (data?.projectId && data.projectId !== projectId) return { ok: false, reason: 'project' }
    const current = quotaOf(data?.[field])
    if (current !== from) return { ok: false, reason: 'stale', quota: current }
    const next = current + TOPUP_AMOUNT
    tx.set(ref, { projectId, updatedAt: FieldValue.serverTimestamp(), [field]: next, lastTopUp: { channel, at: Timestamp.now() } }, { merge: true })
    auditInTransaction(db, tx, request, {
      action: 'usage.quotaTopUp',
      targetType: 'apiUsageQuota',
      targetId: channel,
      before: { quota: current },
      after: { quota: next },
    })
    return { ok: true, quota: next }
  })
}

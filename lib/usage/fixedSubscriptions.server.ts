import 'server-only'
import { FieldValue, type Firestore } from 'firebase-admin/firestore'
import { auditInTransaction } from '@/lib/admin/auditLog'
import { getAdminDb } from '@/lib/firebase/admin'
import { DEFAULT_SUBSCRIPTIONS, normalizeSubscriptions, type FixedSubscription } from './fixedSubscriptions'

export const SUBSCRIPTIONS_DOC = 'system_config/fixed_subscriptions'

/** The stored plan fees, or the defaults when none were saved or Firestore fails. Never throws. */
export async function loadFixedSubscriptions(): Promise<FixedSubscription[]> {
  try {
    const snap = await getAdminDb().doc(SUBSCRIPTIONS_DOC).get()
    return snap.exists ? normalizeSubscriptions(snap.data()?.items) : [...DEFAULT_SUBSCRIPTIONS]
  } catch (error) {
    console.error('[usage] reading the fixed subscriptions failed', error)
    return [...DEFAULT_SUBSCRIPTIONS]
  }
}

/** Replaces the list, with an audit entry in the same transaction. A document that names another project is refused. */
export async function saveFixedSubscriptions(db: Firestore, request: Request, projectId: string, items: FixedSubscription[]): Promise<{ ok: true } | { ok: false; reason: 'project' }> {
  const ref = db.doc(SUBSCRIPTIONS_DOC)
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref)
    const data = snap.exists ? snap.data() : undefined
    if (data?.projectId && data.projectId !== projectId) return { ok: false as const, reason: 'project' as const }
    const before = snap.exists ? normalizeSubscriptions(data?.items) : [...DEFAULT_SUBSCRIPTIONS]
    tx.set(ref, { items, projectId, updatedAt: FieldValue.serverTimestamp(), updatedBy: 'admin' })
    auditInTransaction(db, tx, request, { action: 'usage.fixedSubscriptions', targetType: 'fixedSubscriptions', targetId: 'fixed_subscriptions', before, after: items })
    return { ok: true as const }
  })
}

import 'server-only'
import type { DocumentData, Firestore } from 'firebase-admin/firestore'
import type { AppleRevocation } from './appleRevocation'

// accountDeletionRequests/{uid}: the team's record of each request (what to
// delete, and why), and the 24-hour dedupe that keeps a double tap or a
// retry from emailing the team twice. Written only by the Admin SDK; the
// Firestore rules give clients no access (deny by default).
export const DELETION_REQUESTS = 'accountDeletionRequests'
export const DELETION_DEDUPE_MS = 24 * 60 * 60 * 1000

export interface DeletionRecord {
  uid: string
  email: string
  name: string
  reason: string | null
  details: string
  lang: string
  /** What the member's device reported about their Sign in with Apple tokens; null for other accounts. */
  appleRevocation: AppleRevocation | null
  requestedAt: Date
  status: 'pending'
}

function millis(value: unknown): number | null {
  if (value instanceof Date) return value.getTime()
  const t = value as { toMillis?: () => number } | null
  return typeof t?.toMillis === 'function' ? t.toMillis() : null
}

/**
 * Claims the request slot in a transaction, so two concurrent submissions
 * can't both send. 'duplicate' when a request landed in the last 24 hours;
 * otherwise 'claimed' with a rollback that puts back what was there (a
 * request older than 24h, or nothing) if the email then fails to send.
 */
export async function claimDeletionRequest(
  db: Firestore,
  record: DeletionRecord
): Promise<{ status: 'duplicate' } | { status: 'claimed'; rollback: () => Promise<void> }> {
  const ref = db.collection(DELETION_REQUESTS).doc(record.uid)
  let previous: DocumentData | undefined
  const duplicate = await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref)
    previous = snap.exists ? snap.data() : undefined
    const last = millis(previous?.requestedAt)
    if (last !== null && record.requestedAt.getTime() - last < DELETION_DEDUPE_MS) return true
    tx.set(ref, record)
    return false
  })
  if (duplicate) return { status: 'duplicate' }
  return {
    status: 'claimed',
    rollback: async () => {
      if (previous) await ref.set(previous)
      else await ref.delete()
    },
  }
}

import 'server-only'
import { FieldValue } from 'firebase-admin/firestore'
import { getAdminDb } from '@/lib/firebase/admin'
import { emailHash, SUPPRESSIONS_COLLECTION } from './audience.server'
import { isValidEmail } from '@/lib/validation/email'
import { normalizeEmail } from './unsubscribeToken'

// Admin-side suppressions: an address the team keeps out of every campaign
// (a typo like name@icloiud.com that would only bounce). They live in the same
// newsletter_suppressions collection the sender already honours, keyed by
// emailHash(), with reason 'admin' and the address itself (so the list can
// name it). A recipient's own opt-out (reason 'unsubscribe', or a legacy
// document with no reason) is never overridden: it can be neither replaced
// nor restored from here.

export type SuppressionReason = 'admin' | 'unsubscribe'

export interface SuppressionRow {
  hash: string
  email: string
  reason: SuppressionReason
  /** ISO time of the suppression or opt-out, when recorded. */
  at: string | null
}

const HASH_RE = /^[0-9a-f]{40}$/

export const isSuppressionHash = (value: unknown): value is string => typeof value === 'string' && HASH_RE.test(value)

const reasonOf = (data: FirebaseFirestore.DocumentData | undefined): SuppressionReason => (data?.reason === 'admin' ? 'admin' : 'unsubscribe')

export type SuppressResult = 'suppressed' | 'invalid_email' | 'unsubscribed'

export async function suppressEmail(rawEmail: unknown): Promise<SuppressResult> {
  const email = typeof rawEmail === 'string' ? normalizeEmail(rawEmail) : ''
  if (!email || !isValidEmail(email)) return 'invalid_email'
  const ref = getAdminDb().collection(SUPPRESSIONS_COLLECTION).doc(emailHash(email))
  const existing = await ref.get()
  if (existing.exists && reasonOf(existing.data()) === 'unsubscribe') return 'unsubscribed'
  await ref.set({ reason: 'admin', email, suppressedAt: FieldValue.serverTimestamp() }, { merge: true })
  return 'suppressed'
}

export type RestoreResult = 'restored' | 'not_found' | 'unsubscribed'

export async function restoreSuppression(hash: string): Promise<RestoreResult> {
  const ref = getAdminDb().collection(SUPPRESSIONS_COLLECTION).doc(hash)
  const existing = await ref.get()
  if (!existing.exists) return 'not_found'
  if (reasonOf(existing.data()) === 'unsubscribe') return 'unsubscribed'
  await ref.delete()
  return 'restored'
}

const iso = (value: unknown): string | null => {
  const ms = (value as { toMillis?: () => number } | undefined)?.toMillis?.()
  return typeof ms === 'number' ? new Date(ms).toISOString() : null
}

/** Every suppression whose address is known (admin ones, and opt-outs that carry one), newest first. */
export async function listSuppressions(): Promise<SuppressionRow[]> {
  const snap = await getAdminDb().collection(SUPPRESSIONS_COLLECTION).where('email', '>', '').get()
  const rows = snap.docs.map((doc): SuppressionRow => {
    const data = doc.data()
    const reason = reasonOf(data)
    return { hash: doc.id, email: String(data.email), reason, at: iso(reason === 'admin' ? data.suppressedAt : data.unsubscribedAt) }
  })
  return rows.sort((a, b) => (b.at ?? '').localeCompare(a.at ?? ''))
}

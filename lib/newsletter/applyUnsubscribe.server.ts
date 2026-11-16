import 'server-only'
import { FieldValue } from 'firebase-admin/firestore'
import { getAdminDb } from '@/lib/firebase/admin'
import { LEADS_COLLECTION } from '@/lib/prelaunch/leads.server'
import { emailHash, SUPPRESSIONS_COLLECTION, USERS_COLLECTION } from './audience.server'
import { normalizeEmail } from './unsubscribeToken'

// Opts one address out of marketing email everywhere: every member and lead
// document with that email gets marketingOptIn false and an unsubscribedAt,
// and a suppression document keeps the address out even if no document
// matched (or a lead is created later). Idempotent, and it reveals nothing
// about whether the address was known.

export async function applyUnsubscribe(rawEmail: string): Promise<void> {
  const email = normalizeEmail(rawEmail)
  const db = getAdminDb()
  const [users, leads] = await Promise.all([
    db.collection(USERS_COLLECTION).where('email', '==', email).get(),
    db.collection(LEADS_COLLECTION).where('email', '==', email).get(),
  ])
  const batch = db.batch()
  // A member who later ticks the marketing box again is a fresh consent, so
  // members get only the flag and the time; leads (no checkbox to come back to) are marked unsubscribed.
  const memberPatch = { marketingOptIn: false, unsubscribedAt: FieldValue.serverTimestamp() }
  for (const doc of users.docs) batch.set(doc.ref, memberPatch, { merge: true })
  for (const doc of leads.docs) batch.set(doc.ref, { ...memberPatch, unsubscribed: true }, { merge: true })
  batch.set(db.collection(SUPPRESSIONS_COLLECTION).doc(emailHash(email)), { unsubscribedAt: FieldValue.serverTimestamp(), reason: 'unsubscribe' }, { merge: true })
  await batch.commit()
}

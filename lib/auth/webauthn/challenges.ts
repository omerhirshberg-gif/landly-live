import 'server-only'
import { randomBytes } from 'node:crypto'
import { Timestamp } from 'firebase-admin/firestore'
import { getAdminDb } from '@/lib/firebase/admin'

// One-time WebAuthn challenges (webauthnChallenges/{id}, server-only in
// firestore.rules). A ceremony's options carry the challenge; the client
// gets back only the opaque id and returns it with the response, and the
// verify route consumes it in a transaction, so each challenge verifies at
// most once. Expired documents are refused here and swept by the Firestore
// TTL policy on `expiresAt` (firebase.indexes.json fieldOverrides).
export const CHALLENGE_TTL_MS = 5 * 60 * 1000
const COLLECTION = 'webauthnChallenges'

export type ChallengePurpose = 'register' | 'login'

interface ChallengeDoc {
  challenge: string
  purpose: ChallengePurpose
  uid: string | null
  expiresAt: Timestamp
}

export async function saveChallenge(challenge: string, purpose: ChallengePurpose, uid: string | null = null): Promise<string> {
  const id = randomBytes(18).toString('base64url')
  const doc: ChallengeDoc = { challenge, purpose, uid, expiresAt: Timestamp.fromMillis(Date.now() + CHALLENGE_TTL_MS) }
  await getAdminDb().collection(COLLECTION).doc(id).set(doc)
  return id
}

export function isUsableChallenge(
  doc: Partial<ChallengeDoc> | undefined,
  purpose: ChallengePurpose,
  uid: string | null,
  now = Date.now()
): doc is ChallengeDoc {
  if (!doc || typeof doc.challenge !== 'string') return false
  if (doc.purpose !== purpose) return false
  if ((doc.uid ?? null) !== uid) return false
  return !!doc.expiresAt && doc.expiresAt.toMillis() > now
}

/** The challenge, deleted as it's read; null when missing, expired, or issued for another purpose or member. */
export async function consumeChallenge(id: unknown, purpose: ChallengePurpose, uid: string | null = null): Promise<string | null> {
  if (typeof id !== 'string' || !/^[A-Za-z0-9_-]{16,64}$/.test(id)) return null
  const db = getAdminDb()
  const ref = db.collection(COLLECTION).doc(id)
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref)
    if (!snap.exists) return null
    tx.delete(ref)
    const doc = snap.data() as Partial<ChallengeDoc>
    return isUsableChallenge(doc, purpose, uid) ? doc.challenge : null
  })
}

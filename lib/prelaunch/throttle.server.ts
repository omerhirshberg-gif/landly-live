import 'server-only'
import { createHash } from 'node:crypto'
import { Timestamp, type Firestore } from 'firebase-admin/firestore'

// The /api/prelaunch IP window, in Firestore (prelaunch_throttle/*, server-only
// in firestore.rules) so a cold start or another instance never hands out a
// fresh budget, unlike the in-memory contact form limits. Same shape as
// lib/auth/adminLoginThrottle.ts: the address is hashed, never stored, and
// expired documents are swept by the TTL policy on `expiresAt`.
//
// The ceiling is loose because Israeli mobile carriers put many subscribers
// behind one address, and a creator's post can send them all here at once.
// There is deliberately no global window: one attacker must never be able to
// close the list to a paid campaign's traffic.
export const PRELAUNCH_WINDOW_MS = 15 * 60 * 1000
export const PRELAUNCH_MAX_PER_IP = 20
const COLLECTION = 'prelaunch_throttle'

const ipDocId = (ip: string) => `ip_${createHash('sha256').update(`landly-prelaunch:${ip}`).digest('hex').slice(0, 32)}`

/** Counts this attempt; false when the address has used up its window (nothing counted then). */
export async function reservePrelaunchAttempt(db: Firestore, ip: string, now = Date.now()): Promise<boolean> {
  const ref = db.collection(COLLECTION).doc(ipDocId(ip))
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref)
    const data = snap.data()
    const active = data?.expiresAt instanceof Timestamp && data.expiresAt.toMillis() > now
    const count = active && typeof data?.count === 'number' ? data.count : 0
    if (count >= PRELAUNCH_MAX_PER_IP) return false
    tx.set(ref, { count: count + 1, expiresAt: active ? data!.expiresAt : Timestamp.fromMillis(now + PRELAUNCH_WINDOW_MS) })
    return true
  })
}

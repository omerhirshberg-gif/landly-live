import 'server-only'
import { createHash } from 'node:crypto'
import { Timestamp } from 'firebase-admin/firestore'
import { getAdminDb } from '@/lib/firebase/admin'

// Fixed-window counters in Firestore (rateLimits/*, server-only in
// firestore.rules), so a cold start or a second serverless instance never
// hands out a fresh budget the way the in-memory limiters do. Same shape as
// lib/prelaunch/throttle.server.ts: the key is hashed, never stored, and
// expired documents are swept by the TTL policy on `expiresAt`
// (firebase.indexes.json). getAdminDb() keeps DEV and PROD each on their own
// project.
//
// It guards the routes that cost money or send mail (payment start, OTP and
// email changes, password reset, verification and contact mail). Cheap reads
// stay on the in-memory limiters: a Firestore write per request would cost
// more than the abuse it stops. A request over the limit writes nothing.
//
// Fails open: if Firestore is unreachable the request goes through to the
// in-memory limit the caller already applied, rather than locking every member
// out during an outage.
export const RATE_LIMIT_COLLECTION = 'rateLimits'

export interface DurableLimit {
  /** Which budget: a route family, e.g. 'payment'. */
  scope: string
  /** Who: a uid, or an IP address. */
  key: string
  max: number
  windowMs: number
}

const docId = (scope: string, key: string) => `${scope}_${createHash('sha256').update(`landly-rate:${scope}:${key}`).digest('hex').slice(0, 32)}`

/** Counts this attempt; true when the budget for the window is already spent (nothing is counted then). */
export async function isDurablyLimited({ scope, key, max, windowMs }: DurableLimit, now = Date.now()): Promise<boolean> {
  try {
    const db = getAdminDb()
    const ref = db.collection(RATE_LIMIT_COLLECTION).doc(docId(scope, key))
    return await db.runTransaction(async (tx) => {
      const data = (await tx.get(ref)).data()
      const active = data?.expiresAt instanceof Timestamp && data.expiresAt.toMillis() > now
      const count = active && typeof data?.count === 'number' ? data.count : 0
      if (count >= max) return true
      tx.set(ref, { count: count + 1, expiresAt: active ? data!.expiresAt : Timestamp.fromMillis(now + windowMs) })
      return false
    })
  } catch (error) {
    console.error('Durable rate limit unavailable; using the in-memory limit only', { scope, reason: error instanceof Error ? error.name : 'unknown' })
    return false
  }
}

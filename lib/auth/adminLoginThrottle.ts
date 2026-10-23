import 'server-only'
import { createHash } from 'node:crypto'
import { FieldValue, Timestamp } from 'firebase-admin/firestore'
import { getAdminDb } from '@/lib/firebase/admin'

// The admin password-guessing throttle, kept in Firestore
// (adminLoginThrottle/*, server-only in firestore.rules) so a cold start or
// another serverless instance never hands out a fresh budget. Two windows:
// per IP (hashed; the raw address is never stored), and one across all IPs,
// since ADMIN_PASSWORD unlocks every member's data and a guesser with many
// addresses would otherwise get 10 tries from each. The global ceiling means
// such an attack can lock real admins out for the window too -- the right
// trade for a shared, human-typed password.
//
// Each attempt is counted before the password is checked, in one
// transaction with the lock check, so parallel guesses can't slip past the
// limit; a correct password then clears its IP's count and gives its slot
// back to the global one. Expired documents are swept by the Firestore TTL
// policy on `expiresAt` (firebase.indexes.json fieldOverrides).
export const ADMIN_LOGIN_WINDOW_MS = 15 * 60 * 1000
export const ADMIN_LOGIN_MAX_PER_IP = 10
export const ADMIN_LOGIN_MAX_GLOBAL = 50
const COLLECTION = 'adminLoginThrottle'

const ipDocId = (ip: string) => `ip_${createHash('sha256').update(`landly-admin-login:${ip}`).digest('hex').slice(0, 32)}`

interface Window { count: number; expiresAt: Timestamp }

function activeCount(data: Partial<Window> | undefined, now: number): number {
  if (!data || !(data.expiresAt instanceof Timestamp) || data.expiresAt.toMillis() <= now) return 0
  return typeof data.count === 'number' ? data.count : 0
}

/** Counts this attempt; false when the IP or the global window is already used up (nothing counted then). */
export async function reserveAdminLoginAttempt(ip: string, now = Date.now()): Promise<boolean> {
  const db = getAdminDb()
  const ipRef = db.collection(COLLECTION).doc(ipDocId(ip))
  const globalRef = db.collection(COLLECTION).doc('global')
  return db.runTransaction(async (tx) => {
    const [ipSnap, globalSnap] = await Promise.all([tx.get(ipRef), tx.get(globalRef)])
    const ipCount = activeCount(ipSnap.data(), now)
    const globalCount = activeCount(globalSnap.data(), now)
    if (ipCount >= ADMIN_LOGIN_MAX_PER_IP || globalCount >= ADMIN_LOGIN_MAX_GLOBAL) return false
    const bump = (snap: typeof ipSnap, count: number) => ({
      count: count + 1,
      expiresAt: count === 0 ? Timestamp.fromMillis(now + ADMIN_LOGIN_WINDOW_MS) : (snap.get('expiresAt') as Timestamp),
    })
    tx.set(ipRef, bump(ipSnap, ipCount))
    tx.set(globalRef, bump(globalSnap, globalCount))
    return true
  })
}

/** A correct password: its IP starts over, and its attempt no longer counts against everyone. */
export async function releaseAdminLoginAttempt(ip: string): Promise<void> {
  const db = getAdminDb()
  const ipRef = db.collection(COLLECTION).doc(ipDocId(ip))
  const globalRef = db.collection(COLLECTION).doc('global')
  await db.runTransaction(async (tx) => {
    const globalSnap = await tx.get(globalRef)
    tx.delete(ipRef)
    if (activeCount(globalSnap.data(), Date.now()) > 0) tx.update(globalRef, { count: FieldValue.increment(-1) })
  })
}

import 'server-only'
import { Timestamp } from 'firebase-admin/firestore'
import { getAdminAuth, getAdminDb } from '@/lib/firebase/admin'

// Ends every session a member has: "Sign out of all devices" and a verified
// email change. Revoking the refresh tokens is enough for the API routes
// (verifyIdToken with checkRevoked), but Firestore's rules never see a
// revocation, so an ID token already issued would keep reading vouchers and
// orders until it expires (up to an hour). users/{uid}.sessionsValidAfter
// (server-only in firestore.rules) is what authFresh() there compares each
// token's auth_time with. It mirrors Auth's own tokensValidAfterTime, which
// has whole-second precision like auth_time, so a sign-in made the moment
// after revoking is never refused by a sub-second difference.
export async function revokeMemberSessions(uid: string): Promise<void> {
  await getAdminAuth().revokeRefreshTokens(uid)
  await syncSessionCutoff(uid, Math.floor(Date.now() / 1000) * 1000)
  await clearSessionList(uid)
}

/**
 * Empties users/{uid}/sessions (the devices Privacy & Security lists,
 * lib/account/sessionList.ts): every one of them was just signed out, and
 * each writes its row again when it next signs in.
 */
export async function clearSessionList(uid: string): Promise<void> {
  const db = getAdminDb()
  const { docs } = await db.collection('users').doc(uid).collection('sessions').get()
  for (let i = 0; i < docs.length; i += 500) {
    const batch = db.batch()
    for (const doc of docs.slice(i, i + 500)) batch.delete(doc.ref)
    await batch.commit()
  }
}

/**
 * Copies Auth's revocation cutoff into users/{uid}.sessionsValidAfter. For
 * the revocations Firebase makes on its own -- a password reset or change,
 * an account disabled -- which never pass through revokeMemberSessions.
 * Only ever moves the cutoff forward, so it can't reopen sessions a later
 * revocation closed. Every session Firestore then refuses is one the API
 * routes already refuse; a caller whose own token passed verifyIdToken with
 * checkRevoked signed in at or after the cutoff, so it never locks itself out.
 * `fallbackMs` is used when Auth reports no cutoff at all; without one,
 * nothing was ever revoked and nothing is written.
 */
export async function syncSessionCutoff(uid: string, fallbackMs?: number): Promise<void> {
  const { tokensValidAfterTime } = await getAdminAuth().getUser(uid)
  const parsed = tokensValidAfterTime ? Date.parse(tokensValidAfterTime) : NaN
  const cutoffMs = Number.isNaN(parsed) ? fallbackMs : parsed
  if (cutoffMs === undefined) return
  const db = getAdminDb()
  const ref = db.collection('users').doc(uid)
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref)
    // No profile yet: the rules have nothing of theirs to guard (vouchers
    // and orders need a verified member, whose profile exists).
    if (!snap.exists) return
    const current = snap.get('sessionsValidAfter')
    if (current instanceof Timestamp && current.toMillis() >= cutoffMs) return
    tx.update(ref, { sessionsValidAfter: Timestamp.fromMillis(cutoffMs) })
  })
}

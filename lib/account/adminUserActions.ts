import 'server-only'
import { Timestamp, type Firestore } from 'firebase-admin/firestore'
import type { Auth } from 'firebase-admin/auth'
import { auditInTransaction } from '@/lib/admin/auditLog'
import { parseUserStatus, type UserStatus } from '@/lib/admin/userStatus'

export class UserActionError extends Error {
  constructor(message: string, public readonly status = 400) {
    super(message)
  }
}

/**
 * Moves a member between active, suspended and banned.
 *
 * suspended and banned both disable the Auth account, revoke every refresh
 * token and stamp users/{uid}.sessionsValidAfter (the same steps as
 * scripts/disable-account.mjs), so an ID token already issued stops reading
 * Firestore at once instead of living out its hour. `banned` differs only in
 * what it says: it needs a reason and is meant to be permanent. `active`
 * re-enables sign-in; the cutoff stays, so old sessions stay ended.
 * `status` is a server-only key in firestore.rules.
 */
export async function changeUserStatus(
  db: Firestore, auth: Auth, request: Request, uid: string, next: UserStatus, reason: string,
): Promise<{ before: UserStatus; after: UserStatus }> {
  if (!/^[A-Za-z0-9_-]{6,128}$/.test(uid)) throw new UserActionError('Invalid member.')
  const note = reason.trim().slice(0, 300)
  if (next !== 'active' && !note) throw new UserActionError('A reason is required to suspend or ban.')
  const userRef = db.collection('users').doc(uid)
  const [snap, business] = await Promise.all([userRef.get(), db.collection('businesses').doc(uid).get()])
  if (business.exists) throw new UserActionError('Business accounts are managed under Businesses.')
  if (!snap.exists) throw new UserActionError('Member not found.', 404)
  const before = parseUserStatus(snap.get('status'))
  if (before === next) throw new UserActionError(`Already ${next}.`, 409)

  const disabled = next !== 'active'
  await auth.updateUser(uid, { disabled })
  let cutoffMs: number | null = null
  if (disabled) {
    await auth.revokeRefreshTokens(uid)
    const { tokensValidAfterTime } = await auth.getUser(uid)
    const parsed = tokensValidAfterTime ? Date.parse(tokensValidAfterTime) : NaN
    cutoffMs = Number.isNaN(parsed) ? Math.floor(Date.now() / 1000) * 1000 : parsed
  }
  await db.runTransaction(async (tx) => {
    const current = (await tx.get(userRef)).get('sessionsValidAfter')
    tx.update(userRef, {
      status: next, statusChangedAt: Timestamp.now(), statusReason: next === 'active' ? null : note,
      ...(cutoffMs !== null && (!(current instanceof Timestamp) || current.toMillis() < cutoffMs)
        ? { sessionsValidAfter: Timestamp.fromMillis(cutoffMs) } : {}),
    })
    auditInTransaction(db, tx, request, {
      action: `user.${next === 'active' ? 'reactivate' : next === 'banned' ? 'ban' : 'suspend'}`,
      targetType: 'user', targetId: uid, before: { status: before }, after: { status: next }, note,
    })
  })
  return { before, after: next }
}

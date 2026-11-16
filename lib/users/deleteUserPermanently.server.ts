import 'server-only'
import { createHash } from 'node:crypto'
import { FieldValue, Timestamp, type Firestore } from 'firebase-admin/firestore'
import type { Auth } from 'firebase-admin/auth'
import { writeAudit } from '@/lib/admin/auditLog'
import { UserActionError } from '@/lib/account/adminUserActions'
import { DELETION_REQUESTS } from '@/lib/account/deletionRequests'
import { avatarPath } from '@/lib/avatar/avatar'
import { emailHash, SUPPRESSIONS_COLLECTION } from '@/lib/newsletter/audience.server'
import { normalizeEmail } from '@/lib/newsletter/unsubscribeToken'
import { LEAD_KEYS_COLLECTION, LEADS_COLLECTION, leadKeyId } from '@/lib/prelaunch/leads.server'
import { loadDeletionPreview, type DeletionPreview } from './deletionPreview.server'
import { parseVoucherStatus } from '@/lib/vouchers/status'

// Permanent account erasure (GDPR / Israeli Privacy Protection Law
// Amendment 13, App Store and Google Play account deletion), run by an admin
// from /admin/users/{uid} for a member who asked to be deleted
// (accountDeletionRequests/{uid}, from the website and the app).
//
// What goes: the sign-in (Firebase Auth, which frees the email, phone and
// Apple/Google identifiers), users/{uid} with every subcollection (sessions,
// push tokens), passkeys, pending change codes, the avatar in Storage and the
// member's /join lead and its lookup keys.
//
// What stays, anonymised, because the law and the merchants' money need it:
//  - paid orders (statutory bookkeeping: 7 years): userId becomes
//    'deleted-user', every personal field is dropped, the document id stays;
//  - redeemed vouchers (merchant settlement, MASAV / zero-sum accounting): same
//    anonymisation, and the redemption codes are dropped;
//  - unredeemed vouchers are CANCELLED (status 'cancelled', never 'redeemed',
//    so they can never be settled) and lose their codes, so nobody can redeem
//    them at a merchant.
// Paid, unredeemed vouchers are not refunded here: the admin must confirm they
// were refunded through Tranzila, or that the 14-day Consumer Protection Law
// cancellation period has passed (refundAcknowledged).
//
// Nothing is deleted before sign-in is locked, Auth goes before users/{uid}
// (so a half-finished run still shows the member and can be run again), and
// every step is idempotent. The audit entry is appended last, with a salted
// hash of the uid and counts only: no name, email or phone. Existing audit rows
// are never rewritten. A hash-only newsletter suppression keeps stale lists
// from mailing the person again.

export const DELETED_USER = 'deleted-user'
const BATCH = 400
// Domain-separated, so the hash can't be matched against any other uid hash in the system.
const AUDIT_SALT = 'landly:user-permanent-delete:v1:'

export const uidAuditHash = (uid: string): string => createHash('sha256').update(`${AUDIT_SALT}${uid}`).digest('hex')

export interface StorageBucketLike {
  file(path: string): { delete(options?: { ignoreNotFound?: boolean }): Promise<unknown> }
}

export interface DeleteUserDeps {
  db: Firestore
  auth: Auth
  bucket: StorageBucketLike
}

export interface DeletionSummary {
  vouchersCancelled: number
  vouchersAnonymized: number
  ordersAnonymized: number
  poolItemsReleased: number
  passkeysDeleted: number
  leadsDeleted: number
  avatarRemoved: boolean
  requestCompleted: boolean
  appleLinked: boolean
}

const ID_RE = /^[A-Za-z0-9_-]{6,128}$/

/** Updates every doc where `field == uid`, 400 at a time; the patch moves each out of the query, so it ends. */
async function rewriteOwned(
  db: Firestore, collection: string, uid: string, patchFor: (data: FirebaseFirestore.DocumentData) => FirebaseFirestore.UpdateData<FirebaseFirestore.DocumentData>,
  onEach?: (id: string, data: FirebaseFirestore.DocumentData) => void,
): Promise<number> {
  let total = 0
  for (;;) {
    const snap = await db.collection(collection).where('userId', '==', uid).limit(BATCH).get()
    if (snap.empty) return total
    const batch = db.batch()
    for (const doc of snap.docs) {
      const data = doc.data()
      batch.update(doc.ref, patchFor(data))
      onEach?.(doc.id, data)
    }
    await batch.commit()
    total += snap.docs.length
  }
}

const PERSONAL_FIELDS = ['userName', 'userEmail', 'userPhone', 'displayName', 'email', 'phone', 'firstName', 'lastName'] as const
const stripPersonal = () => Object.fromEntries(PERSONAL_FIELDS.map((field) => [field, FieldValue.delete()]))

export async function deleteUserPermanently(
  { db, auth, bucket }: DeleteUserDeps, request: Request, uid: string, options: { refundAcknowledged: boolean },
): Promise<DeletionSummary> {
  if (!ID_RE.test(uid)) throw new UserActionError('Invalid member.')
  const userRef = db.collection('users').doc(uid)
  const business = await db.collection('businesses').doc(uid).get()
  if (business.exists) throw new UserActionError('Business accounts are managed under Businesses.')

  const preview: DeletionPreview | null = await loadDeletionPreview(db, auth, uid)
  if (!preview) throw new UserActionError('Member not found.', 404)
  if (preview.paidActiveVouchers.length > 0 && !options.refundAcknowledged) {
    throw new UserActionError('This member has paid vouchers that were never redeemed. Confirm they were refunded first.', 409)
  }

  const [userSnap, authUser, emailChange, phoneChange] = await Promise.all([
    userRef.get(),
    auth.getUser(uid).catch(() => null),
    db.collection('emailChangeRequests').doc(uid).get(),
    db.collection('phoneVerifications').doc(uid).get(),
  ])
  const text = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : '')
  const emails = [...new Set([text(userSnap.get('email')), text(authUser?.email), text(emailChange.get('newEmail'))].filter(Boolean).map((e) => normalizeEmail(e)))]
  const phones = [...new Set([text(userSnap.get('phone')), text(authUser?.phoneNumber), text(phoneChange.get('phone'))].filter(Boolean))]

  // 1. Lock sign-in first: whatever fails later, the account is already unusable.
  if (authUser) {
    await auth.updateUser(uid, { disabled: true })
    await auth.revokeRefreshTokens(uid)
  }

  // 2. Vouchers: cancel what is unredeemed, anonymise the rest.
  const now = Timestamp.now()
  let vouchersCancelled = 0
  let vouchersAnonymized = 0
  await rewriteOwned(
    db, 'vouchers', uid,
    (data) => {
      const common = { userId: DELETED_USER, redemptionCode: FieldValue.delete(), redeemToken: FieldValue.delete(), externalCode: FieldValue.delete(), ...stripPersonal() }
      return parseVoucherStatus(data.status) === 'active'
        ? { ...common, status: 'cancelled', cancelledAt: now, cancelReason: 'account_deleted' }
        : { ...common, erasedAt: now }
    },
    (_id, data) => {
      if (parseVoucherStatus(data.status) === 'active') vouchersCancelled += 1
      else vouchersAnonymized += 1
    },
  )

  // 3. Orders and archived orders: kept for bookkeeping, anonymised. A pool order's allocated item is released from the member too.
  const poolOrders: { orderId: string; poolId: string }[] = []
  const ordersAnonymized = await rewriteOwned(
    db, 'orders', uid, () => ({ userId: DELETED_USER, erasedAt: now, ...stripPersonal() }),
    (id, data) => { if (typeof data.poolId === 'string' && data.poolId) poolOrders.push({ orderId: id, poolId: data.poolId }) },
  )
  await rewriteOwned(db, 'supersededOrders', uid, () => ({ userId: DELETED_USER, erasedAt: now, ...stripPersonal() }))
  let poolItemsReleased = 0
  for (const { orderId, poolId } of poolOrders) {
    const items = await db.collection('couponPools').doc(poolId).collection('items').where('orderId', '==', orderId).get()
    for (const item of items.docs) {
      await item.ref.update({ userId: DELETED_USER })
      poolItemsReleased += 1
    }
  }

  // 4. Passkeys and pending change codes.
  const passkeys = await db.collection('passkeys').where('uid', '==', uid).get()
  for (const doc of passkeys.docs) await doc.ref.delete()
  await Promise.all([db.collection('emailChangeRequests').doc(uid).delete(), db.collection('phoneVerifications').doc(uid).delete()])

  // 5. The member's /join lead, found through its email and phone keys, and the keys themselves.
  const leadIds = new Set<string>()
  const keyRefs = [...emails.filter((e): e is string => !!e).map((e) => leadKeyId('email', e)), ...phones.map((p) => leadKeyId('phone', p))]
    .map((id) => db.collection(LEAD_KEYS_COLLECTION).doc(id))
  for (const ref of keyRefs) {
    const snap = await ref.get()
    if (!snap.exists) continue
    if (typeof snap.get('leadId') === 'string') leadIds.add(snap.get('leadId'))
    await ref.delete()
  }
  for (const id of leadIds) await db.collection(LEADS_COLLECTION).doc(id).delete()

  // 6. Hash-only newsletter suppression: no stale list can mail this address again.
  for (const email of emails) {
    if (email) await db.collection(SUPPRESSIONS_COLLECTION).doc(emailHash(email)).set({ reason: 'admin', suppressedAt: now }, { merge: true })
  }

  // 7. The avatar.
  let avatarRemoved = false
  try {
    await bucket.file(avatarPath(uid)).delete({ ignoreNotFound: true })
    avatarRemoved = true
  } catch (err) {
    console.error('Permanent delete: avatar removal failed', err instanceof Error ? err.message : 'unknown error')
  }

  // 8. Auth (frees email, phone and Apple/Google identifiers), then the profile and its subcollections.
  try {
    await auth.deleteUser(uid)
  } catch (err) {
    if ((err as { code?: string })?.code !== 'auth/user-not-found') throw err
  }
  await db.recursiveDelete(userRef)

  // 9. The member's deletion request, if any, is done; what identified them in it goes.
  const requestRef = db.collection(DELETION_REQUESTS).doc(uid)
  const requestSnap = await requestRef.get()
  if (requestSnap.exists) {
    await requestRef.update({ status: 'completed', completedAt: now, completedBy: 'admin', email: FieldValue.delete(), name: FieldValue.delete(), details: FieldValue.delete() })
  }

  const summary: DeletionSummary = {
    vouchersCancelled, vouchersAnonymized, ordersAnonymized, poolItemsReleased,
    passkeysDeleted: passkeys.docs.length, leadsDeleted: leadIds.size, avatarRemoved,
    requestCompleted: requestSnap.exists, appleLinked: preview.appleLinked,
  }

  // 10. Append-only audit: a salted hash of the uid and counts, nothing personal.
  await writeAudit(db, request, {
    action: 'user.permanentDelete', targetType: 'user', targetId: uidAuditHash(uid), after: summary,
    note: preview.appleLinked
      ? 'Signed in with Apple: Apple token revocation happens on the member\'s device, not on the server.'
      : undefined,
  })
  return summary
}

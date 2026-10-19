import { NextResponse } from 'next/server'
import { Timestamp, type DocumentReference } from 'firebase-admin/firestore'
import { getAdminAuth, getAdminDb } from '@/lib/firebase/admin'
import { CLEAR_PENDING_EMAIL, logContactFailure, preflight, replyFor } from '@/lib/account/contactChangeServer'
import { hashEmailChangeToken, isEmailChangeConfirmRateLimited, isEmailChangeToken } from '@/lib/auth/emailChangeToken'
import { applicationOrigin, isValidLang } from '@/lib/auth/requestContext'
import { sendEmailChangedAlert } from '@/lib/email/sendEmailChangeEmail'
import type { Lang } from '@/lib/i18n/translations'

// Applies an email change once the link in the new inbox is opened
// (/confirm-email-change POSTs its token here, so mail scanners that prefetch
// GET links can't use it up). No sign-in: the link may be opened on any
// device, and the token alone names the account. The token is claimed in a
// transaction (single use), then the new address becomes the account's email
// in Firebase Auth (marked verified: this click proved the inbox) and in
// users/{uid}, the pending fields are cleared -- the profile's amber notice
// disappears on every device through its live listener -- and the previous
// address gets a security notice.
export function OPTIONS(request: Request) {
  return preflight(request)
}

type Claim =
  | { kind: 'invalid' }
  | { kind: 'expired' }
  | { kind: 'claimed'; ref: DocumentReference; uid: string; data: FirebaseFirestore.DocumentData }

export async function POST(request: Request) {
  const reply = replyFor(request)
  if (isEmailChangeConfirmRateLimited(request)) return reply({ error: 'Too many requests.', reason: 'rateLimited' }, 429)

  const body = await request.json().catch(() => null)
  if (!isEmailChangeToken(body?.token)) return reply({ error: 'Invalid link.', reason: 'invalid' }, 400)
  const tokenHash = hashEmailChangeToken(body.token)

  const db = getAdminDb()
  let claim: Claim
  try {
    const match = await db.collection('emailChangeRequests').where('tokenHash', '==', tokenHash).limit(1).get()
    if (match.empty) {
      claim = { kind: 'invalid' }
    } else {
      const ref = match.docs[0].ref
      const userRef = db.collection('users').doc(ref.id)
      claim = await db.runTransaction(async (tx) => {
        const snap = await tx.get(ref)
        const data = snap.data()
        if (!data || data.tokenHash !== tokenHash) return { kind: 'invalid' } as const
        tx.delete(ref)
        const expiresAt = data.expiresAt instanceof Timestamp ? data.expiresAt.toMillis() : 0
        if (expiresAt < Date.now()) {
          tx.update(userRef, CLEAR_PENDING_EMAIL)
          return { kind: 'expired' } as const
        }
        return { kind: 'claimed', ref, uid: ref.id, data } as const
      })
    }
  } catch (err) {
    logContactFailure('verify-email-change', 'claim', null, err)
    return reply({ error: 'Service unavailable.', reason: 'unavailable' }, 503)
  }
  if (claim.kind === 'invalid') return reply({ error: 'Invalid link.', reason: 'invalid' }, 410)
  if (claim.kind === 'expired') return reply({ error: 'Link expired.', reason: 'expired' }, 410)

  const { uid, ref, data } = claim
  const newEmail: string = data.newEmail
  const lang: Lang = isValidLang(data.lang) ? data.lang : 'en'
  const adminAuth = getAdminAuth()
  const userRef = db.collection('users').doc(uid)

  let previousEmail: string | undefined
  try {
    previousEmail = (await adminAuth.getUser(uid)).email
    await adminAuth.updateUser(uid, { email: newEmail, emailVerified: true })
  } catch (err) {
    if ((err as { code?: string })?.code === 'auth/email-already-exists') {
      // Someone signed up with that address meanwhile; this change can never apply.
      await userRef.update(CLEAR_PENDING_EMAIL).catch((e) => logContactFailure('verify-email-change', 'clear', uid, e))
      return reply({ error: 'Email in use.', reason: 'emailInUse' }, 409)
    }
    logContactFailure('verify-email-change', 'auth', uid, err)
    // Put the claim back so the same link works once the service recovers.
    await ref.set(data).catch((e) => logContactFailure('verify-email-change', 'restore', uid, e))
    return reply({ error: 'Service unavailable.', reason: 'unavailable' }, 503)
  }

  try {
    await userRef.update({ email: newEmail, ...CLEAR_PENDING_EMAIL })
  } catch (err) {
    // Auth already carries the new address (the source of truth for sign-in);
    // only the profile copy lags, so the change still counts as applied.
    logContactFailure('verify-email-change', 'profile', uid, err)
  }

  if (previousEmail && previousEmail !== newEmail) {
    try {
      await sendEmailChangedAlert({ to: previousEmail, newEmail, lang, origin: applicationOrigin() })
    } catch (err) {
      logContactFailure('verify-email-change', 'alert', uid, err)
    }
  }
  return reply({ ok: true })
}

import { after, NextResponse } from 'next/server'
import { FieldValue, Timestamp } from 'firebase-admin/firestore'
import { getAdminAuth, getAdminDb } from '@/lib/firebase/admin'
import { CLEAR_PENDING_EMAIL, customerOrReply, logContactFailure, preflight, replyFor } from '@/lib/account/contactChangeServer'
import { isOtpCode } from '@/lib/auth/otp'
import { OTP_MAX_ATTEMPTS, otpMatches } from '@/lib/auth/phoneVerification'
import { applicationOrigin, isValidLang } from '@/lib/auth/requestContext'
import { revokeMemberSessions } from '@/lib/auth/sessionRevocation'
import { sendEmailChangedAlert } from '@/lib/email/sendEmailChangeEmail'
import type { Lang } from '@/lib/i18n/translations'
import { updateSubscriberEmail } from '@/lib/responder/updateSubscriberEmail'

// The 6-digit code from the email verification dialog ({ code }), checked
// like a phone code (/api/account/verify-phone-otp) against
// emailChangeRequests/{uid}: a miss uses up one of OTP_MAX_ATTEMPTS, and an
// expired or used-up code clears the pending change, so the member starts
// again from "Change". A match claims the request in the same transaction
// (single use), then the new address becomes the account's email in
// Firebase Auth (marked verified: the code proved the inbox) and in
// users/{uid}, the pending fields are cleared -- the profile's amber notice
// disappears on every device through its live listener -- and the previous
// address gets a security notice. Every session then ends, and this device
// gets a custom token to sign straight back in. A member who opted into marketing has the
// new address carried over to the Responder list in the background
// (lib/responder/updateSubscriberEmail).
export function OPTIONS(request: Request) {
  return preflight(request)
}

type Outcome =
  | { kind: 'claimed'; data: FirebaseFirestore.DocumentData; marketing: { firstName: string } | null }
  | { kind: 'invalidCode'; attemptsLeft: number }
  | { kind: 'expired' | 'tooManyAttempts' | 'noPending' }

const STATUS: Record<Exclude<Outcome['kind'], 'claimed'>, number> = { invalidCode: 400, expired: 410, tooManyAttempts: 429, noPending: 409 }

export async function POST(request: Request) {
  const reply = replyFor(request)
  const decoded = await customerOrReply(request, reply)
  if (decoded instanceof NextResponse) return decoded
  const { uid } = decoded

  const body = await request.json().catch(() => null)
  if (!isOtpCode(body?.code)) return reply({ error: 'Invalid code.', reason: 'invalidCode' }, 400)
  const code: string = body.code

  const db = getAdminDb()
  const userRef = db.collection('users').doc(uid)
  const requestRef = db.collection('emailChangeRequests').doc(uid)

  let outcome: Outcome
  try {
    outcome = await db.runTransaction(async (tx): Promise<Outcome> => {
      const [pending, user] = await Promise.all([tx.get(requestRef), tx.get(userRef)])
      const data = pending.data()
      // No code hash: a confirmation link from before codes replaced links.
      if (!data || typeof data.codeHash !== 'string' || !user.exists || user.get('pendingEmail') !== data.newEmail) {
        if (data) tx.delete(requestRef)
        return { kind: 'noPending' }
      }
      const expiresAt = data.expiresAt instanceof Timestamp ? data.expiresAt.toMillis() : 0
      const attempts = typeof data.attempts === 'number' ? data.attempts : OTP_MAX_ATTEMPTS
      if (expiresAt < Date.now() || attempts >= OTP_MAX_ATTEMPTS) {
        tx.delete(requestRef)
        tx.update(userRef, CLEAR_PENDING_EMAIL)
        return { kind: expiresAt < Date.now() ? 'expired' : 'tooManyAttempts' }
      }
      if (!otpMatches(uid, code, data.codeHash)) {
        const attemptsLeft = OTP_MAX_ATTEMPTS - attempts - 1
        if (attemptsLeft <= 0) {
          tx.delete(requestRef)
          tx.update(userRef, CLEAR_PENDING_EMAIL)
          return { kind: 'tooManyAttempts' }
        }
        tx.update(requestRef, { attempts: FieldValue.increment(1) })
        return { kind: 'invalidCode', attemptsLeft }
      }
      tx.delete(requestRef)
      const firstName = user.get('firstName')
      return { kind: 'claimed', data, marketing: user.get('marketingOptIn') === true ? { firstName: typeof firstName === 'string' ? firstName : '' } : null }
    })
  } catch (err) {
    logContactFailure('verify-email-otp', 'transaction', uid, err)
    return reply({ error: 'Service unavailable.', reason: 'unavailable' }, 503)
  }

  if (outcome.kind !== 'claimed') {
    return reply(
      { error: 'Verification failed.', reason: outcome.kind, ...(outcome.kind === 'invalidCode' ? { attemptsLeft: outcome.attemptsLeft } : {}) },
      STATUS[outcome.kind]
    )
  }

  const { data, marketing } = outcome
  const newEmail: string = data.newEmail
  const lang: Lang = isValidLang(data.lang) ? data.lang : 'en'
  const adminAuth = getAdminAuth()

  let previousEmail: string | undefined
  try {
    previousEmail = (await adminAuth.getUser(uid)).email
    await adminAuth.updateUser(uid, { email: newEmail, emailVerified: true })
  } catch (err) {
    if ((err as { code?: string })?.code === 'auth/email-already-exists') {
      // Someone signed up with that address meanwhile; this change can never apply.
      await userRef.update(CLEAR_PENDING_EMAIL).catch((e) => logContactFailure('verify-email-otp', 'clear', uid, e))
      return reply({ error: 'Email in use.', reason: 'emailInUse' }, 409)
    }
    logContactFailure('verify-email-otp', 'auth', uid, err)
    // Put the claim back so the same code works once the service recovers.
    await requestRef.set(data).catch((e) => logContactFailure('verify-email-otp', 'restore', uid, e))
    return reply({ error: 'Service unavailable.', reason: 'unavailable' }, 503)
  }

  try {
    await userRef.update({ email: newEmail, ...CLEAR_PENDING_EMAIL })
  } catch (err) {
    // Auth already carries the new address (the source of truth for sign-in);
    // only the profile copy lags, so the change still counts as applied.
    logContactFailure('verify-email-otp', 'profile', uid, err)
  }

  // Run by after(), so Responder never holds or fails the verification, yet
  // the platform keeps the function alive until it settles. It never throws
  // and logs its own failures.
  if (marketing && previousEmail && previousEmail.toLowerCase() !== newEmail.toLowerCase()) {
    const change = { uid, oldEmail: previousEmail, newEmail, firstName: marketing.firstName }
    after(() => updateSubscriberEmail(change))
  }

  if (previousEmail && previousEmail !== newEmail) {
    try {
      await sendEmailChangedAlert({ to: previousEmail, newEmail, lang, origin: applicationOrigin() })
    } catch (err) {
      logContactFailure('verify-email-otp', 'alert', uid, err)
    }
  }

  // The account's email moved, so every other session ends (Auth and
  // Firestore alike, lib/auth/sessionRevocation.ts). This device keeps going
  // with a fresh one: it signs in with the custom token (finishEmailChange in
  // lib/account/contactChange.ts). Neither step undoes the change; without a
  // token the device is simply signed out at its next token refresh.
  let customToken: string | undefined
  try {
    await revokeMemberSessions(uid)
    customToken = await adminAuth.createCustomToken(uid)
  } catch (err) {
    logContactFailure('verify-email-otp', 'revoke', uid, err)
  }
  return reply({ ok: true, email: newEmail, ...(customToken ? { customToken } : {}) })
}

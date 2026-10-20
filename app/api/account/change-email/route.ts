import { NextResponse } from 'next/server'
import { FieldValue, Timestamp } from 'firebase-admin/firestore'
import { getAdminAuth, getAdminDb } from '@/lib/firebase/admin'
import { customerOrReply, logContactFailure, preflight, replyFor } from '@/lib/account/contactChangeServer'
import { normalizeEmail, RECENT_SIGN_IN_SECONDS } from '@/lib/auth/emailChange'
import { OTP_RESEND_SECONDS } from '@/lib/auth/otp'
import { generateOtp, hashOtp, OTP_RESEND_COOLDOWN_MS, OTP_TTL_MS } from '@/lib/auth/phoneVerification'
import { applicationOrigin, isValidLang } from '@/lib/auth/requestContext'
import { emailConfigProblem } from '@/lib/email/brandedEmail'
import { sendEmailChangeCode } from '@/lib/email/sendEmailChangeEmail'
import type { Lang } from '@/lib/i18n/translations'

// Starts (or resends) an email change from the profile screens. The new
// address waits in users/{uid}.pendingEmail -- the live `email` in Auth and
// Firestore is untouched -- and a 6-digit code goes to that new inbox;
// /api/account/verify-email-otp applies it once the member types it.
//
// { newEmail, lang }: needs a sign-in from the last few minutes, i.e. the
// client re-entered the current password first. Email+password accounts
// only: a Google account's address is its Google identity.
// { resend: true, lang }: a fresh code to the address already pending (the
// verification dialog's "Resend code"), at most once a minute; the previous
// code stops working and the attempts start over.
// Both answer { pendingEmail, resendIn } for the dialog's countdown.
export function OPTIONS(request: Request) {
  return preflight(request)
}

export async function POST(request: Request) {
  const reply = replyFor(request)
  const decoded = await customerOrReply(request, reply)
  if (decoded instanceof NextResponse) return decoded
  const { uid } = decoded

  const body = await request.json().catch(() => null)
  const lang: Lang = isValidLang(body?.lang) ? body.lang : 'en'
  const adminAuth = getAdminAuth()
  const db = getAdminDb()
  const requestRef = db.collection('emailChangeRequests').doc(uid)

  let userRecord
  try {
    userRecord = await adminAuth.getUser(uid)
  } catch (err) {
    logContactFailure('change-email', 'user', uid, err)
    return reply({ error: 'Authorization service unavailable.', reason: 'unavailable' }, 503)
  }
  if (!userRecord.providerData.some((p) => p.providerId === 'password')) {
    return reply({ error: 'This account signs in with Google.', reason: 'notPasswordAccount' }, 403)
  }

  let newEmail: string
  if (body?.resend === true) {
    const pending = await requestRef.get().catch(() => null)
    const data = pending?.exists ? pending.data() : undefined
    if (!data || typeof data.newEmail !== 'string') return reply({ error: 'No email change is pending.', reason: 'noPending' }, 409)
    const lastSentAt = data.lastSentAt instanceof Timestamp ? data.lastSentAt.toMillis() : 0
    const wait = lastSentAt + OTP_RESEND_COOLDOWN_MS - Date.now()
    if (wait > 0) return reply({ error: 'Too many requests.', reason: 'rateLimited', retryAfter: Math.ceil(wait / 1000) }, 429)
    newEmail = data.newEmail
  } else {
    if (!decoded.auth_time || Date.now() / 1000 - decoded.auth_time > RECENT_SIGN_IN_SECONDS) {
      return reply({ error: 'Re-enter your password first.', reason: 'reauthRequired' }, 403)
    }
    const parsed = normalizeEmail(body?.newEmail)
    if (!parsed) return reply({ error: 'Invalid email.', reason: 'invalidEmail' }, 400)
    if (parsed === userRecord.email?.toLowerCase()) return reply({ error: 'Same email.', reason: 'sameEmail' }, 400)
    try {
      await adminAuth.getUserByEmail(parsed)
      return reply({ error: 'Email in use.', reason: 'emailInUse' }, 409)
    } catch (err) {
      if ((err as { code?: string })?.code !== 'auth/user-not-found') {
        logContactFailure('change-email', 'lookup', uid, err)
        return reply({ error: 'Authorization service unavailable.', reason: 'unavailable' }, 503)
      }
    }
    // One code a minute whatever the address, as for a phone change.
    const previous = await requestRef.get().catch(() => null)
    const previousSentAt = previous?.get('lastSentAt')
    const wait = previousSentAt instanceof Timestamp ? previousSentAt.toMillis() + OTP_RESEND_COOLDOWN_MS - Date.now() : 0
    if (wait > 0) return reply({ error: 'Too many requests.', reason: 'rateLimited', retryAfter: Math.ceil(wait / 1000) }, 429)
    newEmail = parsed
  }

  let origin: string
  try {
    origin = applicationOrigin()
    const problem = emailConfigProblem()
    if (problem) throw new Error(problem)
  } catch (err) {
    logContactFailure('change-email', 'config', uid, err)
    return reply({ error: 'Could not send the email.', reason: 'failed' }, 502)
  }

  const code = generateOtp()
  try {
    const batch = db.batch()
    batch.set(requestRef, {
      newEmail,
      codeHash: hashOtp(uid, code),
      attempts: 0,
      lang,
      expiresAt: Timestamp.fromMillis(Date.now() + OTP_TTL_MS),
      lastSentAt: Timestamp.now(),
    })
    batch.update(db.collection('users').doc(uid), { pendingEmail: newEmail, pendingEmailRequestedAt: FieldValue.serverTimestamp() })
    await batch.commit()
  } catch (err) {
    logContactFailure('change-email', 'store', uid, err)
    return reply({ error: 'Could not save the change.', reason: 'failed' }, 503)
  }

  try {
    await sendEmailChangeCode({ to: newEmail, lang, origin, code })
  } catch (err) {
    // The change stays pending; the dialog's "Resend code" tries again.
    logContactFailure('change-email', 'send', uid, err)
    return reply({ error: 'Could not send the email.', reason: 'failed' }, 502)
  }
  return reply({ ok: true, pendingEmail: newEmail, resendIn: OTP_RESEND_SECONDS })
}

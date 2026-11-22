import { NextResponse } from 'next/server'
import { Timestamp } from 'firebase-admin/firestore'
import { getAdminAuth, getAdminDb } from '@/lib/firebase/admin'
import { customerOrReply, logContactFailure, preflight, replyFor } from '@/lib/account/contactChangeServer'
import { OTP_RESEND_SECONDS } from '@/lib/auth/otp'
import { generateOtp, hashOtp, OTP_RESEND_COOLDOWN_MS, OTP_TTL_MS } from '@/lib/auth/phoneVerification'
import { accountLang, applicationOrigin } from '@/lib/auth/requestContext'
import { normalizePersonName } from '@/lib/auth/names'
import { ensureAuthDisplayName, ensureCustomerProfile } from '@/lib/auth/signupProfile.server'
import { isVerificationIpRateLimited, isVerificationUidRateLimited } from '@/lib/auth/verificationRateLimit'
import { emailConfigProblem } from '@/lib/email/brandedEmail'
import { sendSignupCodeEmail } from '@/lib/email/sendSignupCodeEmail'

// Sends (or re-sends) the 6-digit code that confirms a new email+password
// account, replacing the emailed link. Called right after sign-up, by the
// code dialog's "Resend code", and when an unverified account signs in
// again. The address always comes from the caller's own ID token, so this
// can't be pointed at someone else's inbox.
//
// { lang, firstName?, lastName?, agreedToTerms?, marketingOptIn? } sends a
// code (the first request after sign-up carries the names and consents the
// profile is created from). { status: true } only reports how long the
// resend cooldown still has to run, without sending anything, so the dialog
// opened by a later sign-in shows the right countdown. At most one code a
// minute; the previous code stops working and the attempts start over.
//
// The code's salted hash lives in signupEmailVerifications/{uid}, a
// server-only collection (firestore.rules); the code itself is only ever in
// the email -- and, in development, the server terminal.
export function OPTIONS(request: Request) {
  return preflight(request)
}

// Read per request: development may run without Resend and prints the code instead.
const isDevelopment = () => process.env.NODE_ENV !== 'production'

export async function POST(request: Request) {
  const reply = replyFor(request)
  if (await isVerificationIpRateLimited(request)) return reply({ error: 'Too many requests.', reason: 'rateLimited' }, 429)
  const decoded = await customerOrReply(request, reply)
  if (decoded instanceof NextResponse) return decoded
  const { uid } = decoded

  // Google and Apple vouch for their own addresses.
  if (decoded.firebase.sign_in_provider !== 'password') return reply({ ok: true, resendIn: 0 })

  const adminAuth = getAdminAuth()
  const db = getAdminDb()
  const codeRef = db.collection('signupEmailVerifications').doc(uid)

  let userRecord
  try {
    // The live record, not the token claim, which can be stale for an hour.
    userRecord = await adminAuth.getUser(uid)
  } catch (err) {
    logContactFailure('send-signup-otp', 'user', uid, err)
    return reply({ error: 'Authorization service unavailable.', reason: 'unavailable' }, 503)
  }
  if (userRecord.emailVerified || !userRecord.email) return reply({ ok: true, resendIn: 0 })

  const previous = await codeRef.get().catch(() => null)
  const previousSentAt = previous?.get('lastSentAt')
  const wait = previousSentAt instanceof Timestamp ? previousSentAt.toMillis() + OTP_RESEND_COOLDOWN_MS - Date.now() : 0

  const body = await request.json().catch(() => null)
  if (body?.status === true) return reply({ ok: true, resendIn: wait > 0 ? Math.ceil(wait / 1000) : 0 })
  if (wait > 0) return reply({ error: 'Too many requests.', reason: 'rateLimited', retryAfter: Math.ceil(wait / 1000) }, 429)
  if (await isVerificationUidRateLimited(uid)) return reply({ error: 'Too many requests.', reason: 'rateLimited' }, 429)

  const lang = accountLang(await db.collection('users').doc(uid).get().then((snap) => snap.get('preferredLanguage')).catch(() => undefined), body?.lang)
  const names = { firstName: normalizePersonName(body?.firstName), lastName: normalizePersonName(body?.lastName) }
  const onProfileError = (err: unknown) => logContactFailure('send-signup-otp', 'profile', uid, err)
  // Runs alongside the email; it never throws.
  const profile = Promise.all([
    ensureCustomerProfile(uid, userRecord.email, lang, names, body?.agreedToTerms === true, body?.marketingOptIn === true, onProfileError),
    ensureAuthDisplayName(uid, userRecord.displayName, names, onProfileError),
  ])
  const fail = async (step: string, err: unknown) => {
    logContactFailure('send-signup-otp', step, uid, err)
    await profile
    return reply({ error: 'Could not send the code.', reason: 'failed' }, 502)
  }

  let origin: string
  try {
    origin = applicationOrigin()
  } catch (err) {
    return fail('config', err)
  }
  // Development may run without Resend: the code is printed below instead.
  const mailProblem = emailConfigProblem()
  if (mailProblem && !isDevelopment()) return fail('config', new Error(mailProblem))

  const code = generateOtp()
  try {
    await codeRef.set({
      codeHash: hashOtp(uid, code),
      attempts: 0,
      lang,
      expiresAt: Timestamp.fromMillis(Date.now() + OTP_TTL_MS),
      lastSentAt: Timestamp.now(),
    })
  } catch (err) {
    return fail('store', err)
  }
  if (isDevelopment()) console.info(`[signup-otp] code ${code}`)

  if (!mailProblem) {
    try {
      await sendSignupCodeEmail({ to: userRecord.email, lang, origin, code })
    } catch (err) {
      // Nothing was delivered, so no cooldown: the dialog's "Resend code" may try again at once.
      await codeRef.delete().catch(() => undefined)
      return fail('send', err)
    }
  }

  await profile
  return reply({ ok: true, resendIn: OTP_RESEND_SECONDS })
}

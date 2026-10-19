import { NextResponse } from 'next/server'
import { FieldValue, Timestamp } from 'firebase-admin/firestore'
import { parsePhoneNumberFromString } from 'libphonenumber-js'
import { getAdminDb } from '@/lib/firebase/admin'
import { CLEAR_PENDING_PHONE, customerOrReply, logContactFailure, preflight, replyFor } from '@/lib/account/contactChangeServer'
import { isOtpChannel, OTP_RESEND_SECONDS, type OtpChannel } from '@/lib/auth/otp'
import {
  generateOtp,
  hashOtp,
  OTP_RESEND_COOLDOWN_MS,
  OTP_TTL_MS,
  OtpDeliveryError,
  otpProvider,
  phoneVerificationMode,
} from '@/lib/auth/phoneVerification'
import { isValidLang } from '@/lib/auth/requestContext'
import type { Lang } from '@/lib/i18n/translations'

// A new phone number from the profile screens' "Edit profile" ({ phone,
// lang, channel? }), and the "Resend code" in its verification dialog (the
// same number again). Any country's number is accepted, as E.164.
//
// { mode: 'direct' }: verification is off (lib/auth/phoneVerification.ts);
// the client saves the number itself, as before.
// { mode: 'otp', channel, resendIn }: the number now waits in
// users/{uid}.pendingPhone and a 6-digit code is on its way (WhatsApp by
// default); /api/account/verify-phone-otp applies it.
export function OPTIONS(request: Request) {
  return preflight(request)
}

export async function POST(request: Request) {
  const reply = replyFor(request)
  const decoded = await customerOrReply(request, reply)
  if (decoded instanceof NextResponse) return decoded
  const { uid } = decoded

  const body = await request.json().catch(() => null)
  const parsed = typeof body?.phone === 'string' && body.phone.startsWith('+') ? parsePhoneNumberFromString(body.phone) : undefined
  if (!parsed?.isValid()) return reply({ error: 'Invalid phone number.', reason: 'invalidPhone' }, 400)
  const phone = parsed.number

  if (phoneVerificationMode() === 'direct') return reply({ ok: true, mode: 'direct' })

  const lang: Lang = isValidLang(body?.lang) ? body.lang : 'en'
  const channel: OtpChannel = isOtpChannel(body?.channel) ? body.channel : 'whatsapp'
  const db = getAdminDb()
  const userRef = db.collection('users').doc(uid)
  const verificationRef = db.collection('phoneVerifications').doc(uid)

  try {
    const [user, previous] = await Promise.all([userRef.get(), verificationRef.get()])
    if (user.get('phone') === phone) return reply({ error: 'Same phone number.', reason: 'samePhone' }, 400)
    const lastSentAt = previous.get('lastSentAt')
    const wait = lastSentAt instanceof Timestamp ? lastSentAt.toMillis() + OTP_RESEND_COOLDOWN_MS - Date.now() : 0
    if (wait > 0) return reply({ error: 'Too many requests.', reason: 'rateLimited', retryAfter: Math.ceil(wait / 1000) }, 429)
  } catch (err) {
    logContactFailure('change-phone', 'read', uid, err)
    return reply({ error: 'Service unavailable.', reason: 'unavailable' }, 503)
  }

  const code = generateOtp()
  try {
    const batch = db.batch()
    batch.set(verificationRef, {
      phone,
      channel,
      codeHash: hashOtp(uid, code),
      attempts: 0,
      expiresAt: Timestamp.fromMillis(Date.now() + OTP_TTL_MS),
      lastSentAt: Timestamp.now(),
    })
    batch.update(userRef, { pendingPhone: phone, pendingPhoneRequestedAt: FieldValue.serverTimestamp() })
    await batch.commit()
  } catch (err) {
    logContactFailure('change-phone', 'store', uid, err)
    return reply({ error: 'Could not save the change.', reason: 'failed' }, 503)
  }

  try {
    await otpProvider().send({ phone, code, channel, lang })
  } catch (err) {
    logContactFailure('change-phone', 'deliver', uid, err)
    // Nothing waits on a code that never arrived: no banner is left behind.
    const batch = db.batch()
    batch.delete(verificationRef)
    batch.update(userRef, CLEAR_PENDING_PHONE)
    await batch.commit().catch((e) => logContactFailure('change-phone', 'rollback', uid, e))
    return reply({ error: 'Could not send the code.', reason: 'delivery', channel: err instanceof OtpDeliveryError ? err.channel : channel }, 502)
  }
  return reply({ ok: true, mode: 'otp', channel, resendIn: OTP_RESEND_SECONDS })
}

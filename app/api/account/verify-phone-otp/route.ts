import { NextResponse } from 'next/server'
import { FieldValue, Timestamp } from 'firebase-admin/firestore'
import { getAdminDb } from '@/lib/firebase/admin'
import { CLEAR_PENDING_PHONE, customerOrReply, heldByOther, logContactFailure, phoneHoldersQuery, preflight, replyFor } from '@/lib/account/contactChangeServer'
import { isOtpCode } from '@/lib/auth/otp'
import { OTP_MAX_ATTEMPTS, otpMatches } from '@/lib/auth/phoneVerification'

// The 6-digit code from the phone verification dialog ({ code }). Checked in
// one transaction against phoneVerifications/{uid}: a match moves
// users/{uid}.pendingPhone into `phone`, marks it phoneVerified and clears
// the pending fields (the amber notice disappears on every device through
// its live listener) -- unless another member took the number meanwhile,
// which drops the change (phoneInUse); a miss
// uses up one of OTP_MAX_ATTEMPTS; an expired or used-up code clears the
// pending change, so the member starts again from Edit profile.
export function OPTIONS(request: Request) {
  return preflight(request)
}

type Outcome =
  | { kind: 'verified'; phone: string }
  | { kind: 'invalidCode'; attemptsLeft: number }
  | { kind: 'expired' | 'tooManyAttempts' | 'noPending' | 'phoneInUse' }

const STATUS: Record<Exclude<Outcome['kind'], 'verified'>, number> = { invalidCode: 400, expired: 410, tooManyAttempts: 429, noPending: 409, phoneInUse: 409 }

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
  const verificationRef = db.collection('phoneVerifications').doc(uid)

  let outcome: Outcome
  try {
    outcome = await db.runTransaction(async (tx): Promise<Outcome> => {
      const [verification, user] = await Promise.all([tx.get(verificationRef), tx.get(userRef)])
      const data = verification.data()
      // Read with the rest (a transaction reads before it writes), so two
      // members verifying one number can't both win.
      const holders = typeof data?.phone === 'string' ? await tx.get(phoneHoldersQuery(db, data.phone)) : null
      if (!data || !user.exists || user.get('pendingPhone') !== data.phone) {
        if (data) tx.delete(verificationRef)
        return { kind: 'noPending' }
      }
      const expiresAt = data.expiresAt instanceof Timestamp ? data.expiresAt.toMillis() : 0
      const attempts = typeof data.attempts === 'number' ? data.attempts : OTP_MAX_ATTEMPTS
      if (expiresAt < Date.now() || attempts >= OTP_MAX_ATTEMPTS) {
        tx.delete(verificationRef)
        tx.update(userRef, CLEAR_PENDING_PHONE)
        return { kind: expiresAt < Date.now() ? 'expired' : 'tooManyAttempts' }
      }
      if (!otpMatches(uid, code, data.codeHash)) {
        const attemptsLeft = OTP_MAX_ATTEMPTS - attempts - 1
        if (attemptsLeft <= 0) {
          tx.delete(verificationRef)
          tx.update(userRef, CLEAR_PENDING_PHONE)
          return { kind: 'tooManyAttempts' }
        }
        tx.update(verificationRef, { attempts: FieldValue.increment(1) })
        return { kind: 'invalidCode', attemptsLeft }
      }
      tx.delete(verificationRef)
      if (holders && heldByOther(holders, uid)) {
        tx.update(userRef, CLEAR_PENDING_PHONE)
        return { kind: 'phoneInUse' }
      }
      tx.update(userRef, { phone: data.phone, phoneVerified: true, ...CLEAR_PENDING_PHONE })
      return { kind: 'verified', phone: data.phone }
    })
  } catch (err) {
    logContactFailure('verify-phone-otp', 'transaction', uid, err)
    return reply({ error: 'Service unavailable.', reason: 'unavailable' }, 503)
  }

  if (outcome.kind === 'verified') return reply({ ok: true, phone: outcome.phone })
  return reply(
    { error: 'Verification failed.', reason: outcome.kind, ...(outcome.kind === 'invalidCode' ? { attemptsLeft: outcome.attemptsLeft } : {}) },
    STATUS[outcome.kind]
  )
}

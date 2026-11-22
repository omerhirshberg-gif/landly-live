import { NextResponse } from 'next/server'
import { FieldValue, Timestamp } from 'firebase-admin/firestore'
import { getAdminAuth, getAdminDb } from '@/lib/firebase/admin'
import { customerOrReply, logContactFailure, preflight, replyFor } from '@/lib/account/contactChangeServer'
import { isOtpCode } from '@/lib/auth/otp'
import { OTP_MAX_ATTEMPTS, otpMatches } from '@/lib/auth/phoneVerification'

// The 6-digit code from the sign-up dialog ({ code }), checked against
// signupEmailVerifications/{uid} like the email- and phone-change codes: a
// miss uses up one of OTP_MAX_ATTEMPTS, an expired or used-up code answers
// 410 / 429 (the dialog's "Resend code" starts a fresh one; the doc stays so
// its one-a-minute cooldown can't be skipped by burning attempts). A match
// claims the doc in the same transaction (single use), marks the account's
// email verified in Firebase Auth and users/{uid}, and answers a custom token
// -- the way back in for a client that doesn't hold the password. Clients that
// do hold it sign in with it instead, which keeps a real password session.
export function OPTIONS(request: Request) {
  return preflight(request)
}

type Outcome =
  | { kind: 'claimed'; data: FirebaseFirestore.DocumentData }
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

  const adminAuth = getAdminAuth()
  const db = getAdminDb()
  const codeRef = db.collection('signupEmailVerifications').doc(uid)

  let alreadyVerified = false
  try {
    alreadyVerified = (await adminAuth.getUser(uid)).emailVerified
  } catch (err) {
    logContactFailure('verify-signup-otp', 'user', uid, err)
    return reply({ error: 'Service unavailable.', reason: 'unavailable' }, 503)
  }

  const mintToken = async () => adminAuth.createCustomToken(uid).catch((err) => {
    logContactFailure('verify-signup-otp', 'token', uid, err)
    return undefined
  })

  // A link clicked from an older email, or a second tab, got there first.
  if (alreadyVerified) {
    await codeRef.delete().catch(() => undefined)
    return reply({ ok: true, customToken: await mintToken() })
  }

  let outcome: Outcome
  try {
    outcome = await db.runTransaction(async (tx): Promise<Outcome> => {
      const snap = await tx.get(codeRef)
      const data = snap.data()
      if (!data || typeof data.codeHash !== 'string') return { kind: 'noPending' }
      const expiresAt = data.expiresAt instanceof Timestamp ? data.expiresAt.toMillis() : 0
      const attempts = typeof data.attempts === 'number' ? data.attempts : OTP_MAX_ATTEMPTS
      if (expiresAt < Date.now()) return { kind: 'expired' }
      if (attempts >= OTP_MAX_ATTEMPTS) return { kind: 'tooManyAttempts' }
      if (!otpMatches(uid, code, data.codeHash)) {
        tx.update(codeRef, { attempts: FieldValue.increment(1) })
        const attemptsLeft = OTP_MAX_ATTEMPTS - attempts - 1
        return attemptsLeft <= 0 ? { kind: 'tooManyAttempts' } : { kind: 'invalidCode', attemptsLeft }
      }
      tx.delete(codeRef)
      return { kind: 'claimed', data }
    })
  } catch (err) {
    logContactFailure('verify-signup-otp', 'transaction', uid, err)
    return reply({ error: 'Service unavailable.', reason: 'unavailable' }, 503)
  }

  if (outcome.kind !== 'claimed') {
    return reply(
      { error: 'Verification failed.', reason: outcome.kind, ...(outcome.kind === 'invalidCode' ? { attemptsLeft: outcome.attemptsLeft } : {}) },
      STATUS[outcome.kind]
    )
  }

  try {
    await adminAuth.updateUser(uid, { emailVerified: true })
  } catch (err) {
    logContactFailure('verify-signup-otp', 'auth', uid, err)
    // Put the claim back so the same code works once the service recovers.
    await codeRef.set(outcome.data).catch((e) => logContactFailure('verify-signup-otp', 'restore', uid, e))
    return reply({ error: 'Service unavailable.', reason: 'unavailable' }, 503)
  }

  // Auth is the source of truth for sign-in; a lagging profile copy still counts as verified.
  await db.collection('users').doc(uid).set({ emailVerifiedAt: FieldValue.serverTimestamp() }, { merge: true })
    .catch((err) => logContactFailure('verify-signup-otp', 'profile', uid, err))

  return reply({ ok: true, customToken: await mintToken() })
}

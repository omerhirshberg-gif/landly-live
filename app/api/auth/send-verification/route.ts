import { NextResponse } from 'next/server'
import { FieldValue } from 'firebase-admin/firestore'
import { getAdminAuth, getAdminDb } from '@/lib/firebase/admin'
import { requireCustomer, RequestAuthError } from '@/lib/firebase/verifyRequestUser'
import { sendVerificationEmail } from '@/lib/email/sendVerificationEmail'
import { EmailProviderError, emailConfigProblem } from '@/lib/email/brandedEmail'
import { corsHeaders } from '@/lib/auth/cors'
import type { Lang } from '@/lib/i18n/translations'
import { isValidLang, applicationOrigin } from '@/lib/auth/requestContext'
import { isVerificationIpRateLimited, isVerificationUidRateLimited } from '@/lib/auth/verificationRateLimit'
import { fullName, normalizePersonName } from '@/lib/auth/names'

// gRPC status for a create() on a doc that's already there.
const ALREADY_EXISTS = 6

// Sign-up no longer writes the customer profile from the client (that held
// "Creating account…" on a Firestore round trip), so it's created here, off
// the UI's critical path; admin/orphans relies on every customer account
// having one. create() never overwrites an existing doc. A failure is only
// logged: signInCustomerWithEmail also creates it on the first verified sign-in.
// The names come from the sign-up form (only the first request carries them).
async function ensureCustomerProfile(
  uid: string,
  email: string,
  lang: Lang,
  names: { firstName: string; lastName: string },
  agreedToTerms: boolean
) {
  try {
    await getAdminDb().collection('users').doc(uid).create({
      email,
      firstName: names.firstName,
      lastName: names.lastName,
      displayName: fullName(names.firstName, names.lastName),
      phone: '',
      customerType: '',
      wishlistOfferIds: [],
      preferredLanguage: lang,
      notificationsOptIn: false,
      createdAt: FieldValue.serverTimestamp(),
      // The sign-up form's Terms/Privacy checkbox (required there to submit),
      // which also confirms the member is 16 or older.
      ...(agreedToTerms ? { agreedToTerms: true, isAgeConfirmed: true, termsAgreedAt: FieldValue.serverTimestamp() } : {}),
    })
  } catch (err) {
    if ((err as { code?: unknown })?.code !== ALREADY_EXISTS) logFailure('profile', uid, err)
  }
}

// The unverified client can't write its own Auth profile after signing out,
// so the display name is set here too -- only if it's still empty, so a
// later edit from the profile page is never overwritten. That's also where
// ensureUserDocument finds the name if the create above ever failed.
async function ensureAuthDisplayName(uid: string, current: string | undefined, names: { firstName: string; lastName: string }) {
  const displayName = fullName(names.firstName, names.lastName)
  if (!displayName || current) return
  try {
    await getAdminAuth().updateUser(uid, { displayName })
  } catch (err) {
    logFailure('profile', uid, err)
  }
}

type Step = 'auth' | 'token' | 'role' | 'user' | 'profile' | 'config' | 'link' | 'resend'

// One structured line per failure, naming the step and the provider's own
// error code, so a log search shows exactly where a send broke. The uid is
// logged; the email address and the ID token never are.
function logFailure(step: Step, uid: string | null, err: unknown, extra: Record<string, unknown> = {}) {
  const e = err as { code?: unknown; statusCode?: unknown; message?: unknown } | null
  const detail = {
    step,
    uid,
    code: err instanceof EmailProviderError ? err.code : e?.code,
    status: err instanceof EmailProviderError ? err.statusCode : e?.statusCode,
    message: typeof e?.message === 'string' ? e.message : String(err),
    ...extra,
  }
  console.error(`[send-verification] step=${step}`, JSON.stringify(detail))
}

// Sends (or re-sends) the branded verification email for the caller's own
// email+password account. Called right after sign-up, and by the "resend"
// button when an unverified account tries to sign in -- from the website
// (same origin) and from the mobile app (native, or its Expo web build, which
// needs the CORS headers). There is no email param: the address always
// comes from the caller's verified ID token, so this can't be pointed at
// someone else's inbox. Failures answer with a coarse `reason` only; the
// details go to the server log (logFailure).
export function OPTIONS(request: Request) {
  return new NextResponse(null, { status: 204, headers: corsHeaders(request) })
}

export async function POST(request: Request) {
  const cors = corsHeaders(request)
  const reply = (body: Record<string, unknown>, status = 200) => NextResponse.json(body, { status, headers: cors })

  let decoded
  try {
    decoded = await requireCustomer(request)
  } catch (error) {
    if (error instanceof RequestAuthError) {
      // A missing header usually means a redirect stripped it (e.g. the
      // apex domain redirecting to www) -- worth telling apart from a bad token.
      const hasAuthorization = request.headers.has('authorization')
      logFailure(error.status === 401 ? 'token' : error.status === 403 ? 'role' : 'auth', null, error, { hasAuthorization })
      return reply({ error: error.message, reason: error.status === 503 ? 'unavailable' : 'unauthorized' }, error.status)
    }
    logFailure('auth', null, error)
    return reply({ error: 'Authorization service unavailable.', reason: 'unavailable' }, 503)
  }

  // Counted only once the token checks out, so rejected or token-less
  // requests (e.g. a redirect that stripped the header) can't use up the
  // IP's quota. A forged token fails signature verification locally, before
  // any network call; the per-account limit below caps real accounts.
  if (isVerificationIpRateLimited(request)) {
    return reply({ error: 'Too many requests. Try again later.', reason: 'rateLimited' }, 429)
  }

  // Google (and any future federated) sign-ins are verified by their provider.
  if (decoded.firebase.sign_in_provider !== 'password') return reply({ ok: true })

  const adminAuth = getAdminAuth()
  // Checked against the live record, not the token claim, which can be up to
  // an hour stale after the user has already clicked the link.
  let userRecord
  try {
    userRecord = await adminAuth.getUser(decoded.uid)
  } catch (err) {
    logFailure('user', decoded.uid, err)
    return reply({ error: 'Authorization service unavailable.', reason: 'unavailable' }, 503)
  }
  if (userRecord.emailVerified || !userRecord.email) return reply({ ok: true })

  if (isVerificationUidRateLimited(decoded.uid)) {
    return reply({ error: 'Too many requests. Try again later.', reason: 'rateLimited' }, 429)
  }

  const body = await request.json().catch(() => null)
  const lang: Lang = isValidLang(body?.lang) ? body.lang : 'en'
  const names = { firstName: normalizePersonName(body?.firstName), lastName: normalizePersonName(body?.lastName) }
  // Runs alongside the email; it never throws.
  const profile = Promise.all([
    ensureCustomerProfile(decoded.uid, userRecord.email, lang, names, body?.agreedToTerms === true),
    ensureAuthDisplayName(decoded.uid, userRecord.displayName, names),
  ])
  const fail = async (step: Step, err: unknown, reason: 'config' | 'link' | 'provider') => {
    logFailure(step, decoded.uid, err)
    await profile
    return reply({ error: 'Could not send verification email.', reason }, 502)
  }

  let origin: string
  try {
    origin = applicationOrigin()
    const problem = emailConfigProblem()
    if (problem) throw new Error(problem)
  } catch (err) {
    return fail('config', err, 'config')
  }

  let verifyLink: string
  try {
    // Only the oobCode is taken from Firebase's link. The email points at our
    // own /verify-email page, which applies the code client-side, so users
    // never land on Firebase's hosted __/auth/action widget (the Console's
    // action URL setting is broken for this project; /api/auth/forgot-password
    // does the same for reset links).
    const firebaseLink = await adminAuth.generateEmailVerificationLink(userRecord.email)
    const oobCode = new URL(firebaseLink).searchParams.get('oobCode')
    if (!oobCode) throw new Error('generateEmailVerificationLink returned no oobCode')
    verifyLink = `${origin}/verify-email?oobCode=${encodeURIComponent(oobCode)}`
  } catch (err) {
    return fail('link', err, 'link')
  }

  try {
    await sendVerificationEmail({ to: userRecord.email, lang, verifyLink, origin })
  } catch (err) {
    return fail('resend', err, 'provider')
  }

  await profile
  return reply({ ok: true })
}

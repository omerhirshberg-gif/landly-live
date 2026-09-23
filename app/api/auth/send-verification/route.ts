import { NextResponse } from 'next/server'
import { getAdminAuth } from '@/lib/firebase/admin'
import { requireCustomer, RequestAuthError } from '@/lib/firebase/verifyRequestUser'
import { sendVerificationEmail } from '@/lib/email/sendVerificationEmail'
import type { Lang } from '@/lib/i18n/translations'
import { isValidLang, applicationOrigin } from '@/lib/auth/requestContext'
import { isVerificationIpRateLimited, isVerificationUidRateLimited } from '@/lib/auth/verificationRateLimit'

// Sends (or re-sends) the branded verification email for the caller's own
// email+password account. Called by the signup page right after account
// creation, and by the login page's "resend" button when an unverified
// account tries to sign in. There is no email param: the address always
// comes from the caller's verified ID token, so this can't be pointed at
// someone else's inbox.
export async function POST(request: Request) {
  if (isVerificationIpRateLimited(request)) {
    return NextResponse.json({ error: 'Too many requests. Try again later.' }, { status: 429 })
  }

  let decoded
  try {
    decoded = await requireCustomer(request)
  } catch (error) {
    if (error instanceof RequestAuthError) return NextResponse.json({ error: error.message }, { status: error.status })
    return NextResponse.json({ error: 'Authorization service unavailable.' }, { status: 503 })
  }

  // Google (and any future federated) sign-ins are verified by their provider.
  if (decoded.firebase.sign_in_provider !== 'password') return NextResponse.json({ ok: true })

  const adminAuth = getAdminAuth()
  // Checked against the live record, not the token claim, which can be up to
  // an hour stale after the user has already clicked the link.
  const userRecord = await adminAuth.getUser(decoded.uid)
  if (userRecord.emailVerified || !userRecord.email) return NextResponse.json({ ok: true })

  if (isVerificationUidRateLimited(decoded.uid)) {
    return NextResponse.json({ error: 'Too many requests. Try again later.' }, { status: 429 })
  }

  const body = await request.json().catch(() => null)
  const lang: Lang = isValidLang(body?.lang) ? body.lang : 'en'

  try {
    const origin = applicationOrigin()
    // Only the oobCode is taken from Firebase's link. The email points at our
    // own /verify-email page, which applies the code client-side, so users
    // never land on Firebase's hosted __/auth/action widget (see
    // app/reset-password/success/page.tsx for why that widget is a problem).
    const firebaseLink = await adminAuth.generateEmailVerificationLink(userRecord.email)
    const oobCode = new URL(firebaseLink).searchParams.get('oobCode')
    if (!oobCode) throw new Error('generateEmailVerificationLink returned no oobCode')
    const verifyLink = `${origin}/verify-email?oobCode=${encodeURIComponent(oobCode)}`

    await sendVerificationEmail({ to: userRecord.email, lang, verifyLink, origin })
  } catch (err) {
    console.error('send-verification failed', err)
    return NextResponse.json({ error: 'Could not send verification email.' }, { status: 502 })
  }

  return NextResponse.json({ ok: true })
}

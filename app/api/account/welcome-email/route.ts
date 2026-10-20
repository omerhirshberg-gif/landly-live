import { NextResponse } from 'next/server'
import { FieldValue } from 'firebase-admin/firestore'
import { getAdminAuth, getAdminDb } from '@/lib/firebase/admin'
import { requireVerifiedCustomerUid, RequestAuthError } from '@/lib/firebase/verifyRequestUser'
import { sendWelcomeEmail } from '@/lib/email/sendWelcomeEmail'
import { EmailProviderError, emailConfigProblem } from '@/lib/email/brandedEmail'
import { corsHeaders } from '@/lib/auth/cors'
import { applicationOrigin, isValidLang } from '@/lib/auth/requestContext'

// Only a member who finished onboarding this recently is welcomed, so the
// route can never email members who onboarded before it existed.
const WELCOME_WINDOW_MS = 24 * 60 * 60 * 1000

type Step = 'auth' | 'claim' | 'user' | 'config' | 'resend' | 'release'

// One structured line per failure, like /api/auth/send-verification: the uid
// and the provider's error code, never the email address.
function logFailure(step: Step, uid: string | null, err: unknown) {
  const e = err as { code?: unknown; statusCode?: unknown; message?: unknown } | null
  const detail = {
    step,
    uid,
    code: err instanceof EmailProviderError ? err.code : e?.code,
    status: err instanceof EmailProviderError ? err.statusCode : e?.statusCode,
    message: typeof e?.message === 'string' ? e.message : String(err),
  }
  console.error(`[welcome-email] step=${step}`, JSON.stringify(detail))
}

// The "Welcome to Landly" email, sent once per member right after the
// onboarding wizard stores its answers (website and app, both of which call
// this fire-and-forget, so nothing here ever holds the celebration card).
// At most once: users/{uid}.welcomeEmailSent is claimed in a transaction
// before sending (two racing calls can't both win) and is server-only in
// firestore.rules, so a client can't reset it. A failed send releases the
// claim; it's logged, not retried. The address comes from the Auth record,
// the language and first name from the profile the wizard just wrote.
// CORS for the app's Expo web build (lib/auth/cors.ts).
export function OPTIONS(request: Request) {
  return new NextResponse(null, { status: 204, headers: corsHeaders(request) })
}

export async function POST(request: Request) {
  const cors = corsHeaders(request)
  const reply = (body: Record<string, unknown>, status = 200) => NextResponse.json(body, { status, headers: cors })

  let uid: string
  try {
    uid = await requireVerifiedCustomerUid(request)
  } catch (err) {
    if (err instanceof RequestAuthError) return reply({ error: err.message }, err.status)
    logFailure('auth', null, err)
    return reply({ error: 'Authorization service unavailable.' }, 503)
  }

  let origin: string
  try {
    origin = applicationOrigin()
    const problem = emailConfigProblem()
    if (problem) throw new Error(problem)
  } catch (err) {
    logFailure('config', uid, err)
    return reply({ error: 'Could not send welcome email.' }, 502)
  }

  const ref = getAdminDb().collection('users').doc(uid)
  let profile: { lang: string; firstName: string } | null
  let skipped: 'notOnboarded' | 'stale' | 'alreadySent' | null = null
  try {
    profile = await getAdminDb().runTransaction(async (tx) => {
      const snap = await tx.get(ref)
      const data = snap.data()
      const completedAt = data?.onboardingCompletedAt?.toMillis?.() as number | undefined
      if (!data || completedAt === undefined) {
        skipped = 'notOnboarded'
        return null
      }
      if (data.welcomeEmailSent === true) {
        skipped = 'alreadySent'
        return null
      }
      if (Date.now() - completedAt > WELCOME_WINDOW_MS) {
        skipped = 'stale'
        return null
      }
      tx.update(ref, { welcomeEmailSent: true, welcomeEmailSentAt: FieldValue.serverTimestamp() })
      return {
        lang: typeof data.preferredLanguage === 'string' ? data.preferredLanguage : 'en',
        firstName: typeof data.firstName === 'string' ? data.firstName : '',
      }
    })
  } catch (err) {
    logFailure('claim', uid, err)
    return reply({ error: 'Could not send welcome email.' }, 503)
  }
  if (!profile) return reply({ ok: true, sent: false, reason: skipped })

  const release = async () => {
    try {
      await ref.update({ welcomeEmailSent: FieldValue.delete(), welcomeEmailSentAt: FieldValue.delete() })
    } catch (err) {
      logFailure('release', uid, err)
    }
  }

  let email: string | undefined
  try {
    email = (await getAdminAuth().getUser(uid)).email
    if (!email) throw new Error('account has no email')
  } catch (err) {
    logFailure('user', uid, err)
    await release()
    return reply({ error: 'Could not send welcome email.' }, 502)
  }

  try {
    await sendWelcomeEmail({ to: email, lang: isValidLang(profile.lang) ? profile.lang : 'en', origin, firstName: profile.firstName })
  } catch (err) {
    logFailure('resend', uid, err)
    await release()
    return reply({ error: 'Could not send welcome email.' }, 502)
  }
  return reply({ ok: true, sent: true })
}

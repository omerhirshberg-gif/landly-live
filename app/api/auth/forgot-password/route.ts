import { NextResponse } from 'next/server'
import { getAdminAuth } from '@/lib/firebase/admin'
import { sendPasswordResetEmail } from '@/lib/email/sendPasswordResetEmail'
import type { Lang } from '@/lib/i18n/translations'
import { isPasswordResetRateLimited } from '@/lib/auth/passwordResetRateLimit'
import { isValidLang, applicationOrigin } from '@/lib/auth/requestContext'

// A common response and minimum duration reduce account enumeration signals.
// Upstream calls exceeding the floor can still reveal timing differences.
const MIN_RESPONSE_MS = 2000
function genericSuccess(): NextResponse {
  return NextResponse.json({ ok: true })
}

export async function POST(request: Request) {
  if (isPasswordResetRateLimited(request)) {
    return NextResponse.json({ error: 'Too many requests. Try again later.' }, { status: 429 })
  }

  const startedAt = performance.now()
  async function delayedSuccess(): Promise<NextResponse> {
    const remaining = MIN_RESPONSE_MS - (performance.now() - startedAt)
    if (remaining > 0) await new Promise((resolve) => setTimeout(resolve, remaining))
    return genericSuccess()
  }

  const body = await request.json().catch(() => null)
  const email = typeof body?.email === 'string' ? body.email.trim() : ''
  const lang: Lang = isValidLang(body?.lang) ? body.lang : 'en'

  if (!email) return delayedSuccess()

  try {
    const origin = applicationOrigin()
    // Only the oobCode is taken from Firebase's link, as in send-verification.
    // The link's host comes from the Console's action URL template (broken for
    // this project), so the email points at our own /reset-password page,
    // which checks and applies the code client-side. No ActionCodeSettings:
    // a continue URL only matters on Firebase's hosted widget, which users
    // never reach, and Firebase rejects one outside the project's authorized
    // domains (auth/unauthorized-continue-uri), e.g. a LAN APP_URL in dev.
    const firebaseLink = await getAdminAuth().generatePasswordResetLink(email)
    const oobCode = new URL(firebaseLink).searchParams.get('oobCode')
    if (!oobCode) throw new Error('generatePasswordResetLink returned no oobCode')
    const resetLink = `${origin}/reset-password?oobCode=${encodeURIComponent(oobCode)}`
    await sendPasswordResetEmail({ to: email, lang, resetLink, origin })
  } catch (err) {
    // Deliberately swallowed: a nonexistent account (auth/user-not-found) and
    // a real send failure must look identical to the caller.
    console.error('forgot-password request failed', err)
  }

  return delayedSuccess()
}

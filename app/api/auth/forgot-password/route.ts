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
    const resetLink = await getAdminAuth().generatePasswordResetLink(email, {
      // See app/reset-password/success/page.tsx: Firebase's Console "Customize
      // action URL" field is broken for this project, so the link still routes
      // through Firebase's hosted __/auth/action widget, which consumes the
      // oobCode and redirects here as continueUrl.
      url: `${origin}/reset-password/success`,
      handleCodeInApp: true,
    })
    await sendPasswordResetEmail({ to: email, lang, resetLink, origin })
  } catch (err) {
    // Deliberately swallowed: a nonexistent account (auth/user-not-found) and
    // a real send failure must look identical to the caller.
    console.error('forgot-password request failed', err)
  }

  return delayedSuccess()
}

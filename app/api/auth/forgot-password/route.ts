import { NextResponse } from 'next/server'
import { getAdminAuth } from '@/lib/firebase/admin'
import { sendPasswordResetEmail } from '@/lib/email/sendPasswordResetEmail'
import { translations, type Lang } from '@/lib/i18n/translations'
import { isPasswordResetRateLimited } from '@/lib/auth/passwordResetRateLimit'

const KNOWN_LANGS = Object.keys(translations) as Lang[]

function isValidLang(value: unknown): value is Lang {
  return typeof value === 'string' && (KNOWN_LANGS as string[]).includes(value)
}

function requestOrigin(request: Request): string {
  const proto = request.headers.get('x-forwarded-proto') ?? 'https'
  const host = request.headers.get('host')
  return `${proto}://${host}`
}

// Always resolves to the same generic response regardless of whether the
// email exists, so this endpoint can't be used to enumerate accounts.
function genericSuccess(): NextResponse {
  return NextResponse.json({ ok: true })
}

export async function POST(request: Request) {
  if (isPasswordResetRateLimited(request)) {
    return NextResponse.json({ error: 'Too many requests. Try again later.' }, { status: 429 })
  }

  const body = await request.json().catch(() => null)
  const email = typeof body?.email === 'string' ? body.email.trim() : ''
  const lang: Lang = isValidLang(body?.lang) ? body.lang : 'en'

  if (!email) return genericSuccess()

  const origin = requestOrigin(request)

  try {
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

  return genericSuccess()
}

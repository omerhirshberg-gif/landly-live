import { NextResponse } from 'next/server'
import { checkAdminPasswordWithRateLimit } from '@/lib/admin/adminAuth'
import { ADMIN_SESSION_COOKIE, adminSessionCookieOptions, issueAdminSessionToken } from '@/lib/admin/sessionToken'

// The admin login: a correct password sets the session cookie, for 30 days
// with "Stay logged in" (remember: true), else 12 hours. The token never
// reaches page scripts.
export async function POST(request: Request) {
  const body = await request.json().catch(() => null)
  const password = typeof body?.password === 'string' ? body.password : null
  const remember = body?.remember === true

  const denied = await checkAdminPasswordWithRateLimit(request, password)
  if (denied) return denied
  const response = NextResponse.json({ ok: true })
  response.cookies.set(ADMIN_SESSION_COOKIE, issueAdminSessionToken(remember), adminSessionCookieOptions(remember))
  return response
}

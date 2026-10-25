import { NextResponse } from 'next/server'
import { requireAdminAuth } from '@/lib/admin/adminAuth'
import { ADMIN_SESSION_COOKIE, adminSessionCookieOptions, adminSessionExpiry, adminSessionFromCookies } from '@/lib/admin/sessionToken'

// The admin session cookie (lib/admin/sessionToken.ts), which page scripts
// can't read. GET: whether it is still valid, for AdminGate to skip the login
// page; DELETE: log out.

export function GET(request: Request) {
  const denied = requireAdminAuth(request)
  if (denied) return denied
  const expiresAt = adminSessionExpiry(adminSessionFromCookies(request.headers.get('cookie')))
  return NextResponse.json({ ok: true, ...(expiresAt ? { expiresAt: new Date(expiresAt).toISOString() } : {}) }, { headers: { 'Cache-Control': 'no-store' } })
}

// No session needed to end one: the cookie is cleared either way.
export function DELETE() {
  const response = NextResponse.json({ ok: true })
  // The same attributes it was set with (Path=/ above all), or the browser keeps the original.
  response.cookies.set(ADMIN_SESSION_COOKIE, '', { ...adminSessionCookieOptions(false), maxAge: 0 })
  return response
}

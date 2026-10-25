import 'server-only'
import { createHmac, timingSafeEqual } from 'node:crypto'

// Signed, expiring credential issued by /api/admin/verify-password after a
// correct ADMIN_PASSWORD check (see checkAdminPassword.ts, unchanged), so
// the client only ever needs the raw password once, at login, instead of
// holding and resending it on every request. Signed with its own secret
// (ADMIN_SESSION_SECRET) rather than ADMIN_PASSWORD itself, so leaking one
// doesn't leak the other, and so all outstanding sessions can be force-
// invalidated by rotating this secret without touching the login password.
//
// The browser holds it in an httpOnly cookie (ADMIN_SESSION_COOKIE), which
// page scripts can't read and every same-origin admin call carries: "Stay
// logged in" makes it last REMEMBER_TTL_MS, otherwise SESSION_TTL_MS. The
// cookie's Max-Age and the token's own exp always match.
export const SESSION_TTL_MS = 12 * 60 * 60 * 1000
export const REMEMBER_TTL_MS = 30 * 24 * 60 * 60 * 1000
export const ADMIN_SESSION_COOKIE = 'landly_admin_session'

function getSecret(): string | undefined {
  return process.env.ADMIN_SESSION_SECRET
}

function sign(payloadB64: string, secret: string): string {
  return createHmac('sha256', secret).update(payloadB64).digest('base64url')
}

// Throws rather than silently issuing an unverifiable token -- a missing
// secret should fail loudly at login, not manifest later as "login works
// but every subsequent admin call 401s" with no obvious cause.
export function issueAdminSessionToken(remember = false, now = Date.now()): string {
  const secret = getSecret()
  if (!secret) throw new Error('ADMIN_SESSION_SECRET is not configured.')

  const payload = { exp: now + (remember ? REMEMBER_TTL_MS : SESSION_TTL_MS) }
  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString('base64url')
  return `${payloadB64}.${sign(payloadB64, secret)}`
}

/** The session cookie's attributes: Secure wherever the site is served over https (every Vercel deployment), not on http://localhost. */
export function adminSessionCookieOptions(remember: boolean) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge: (remember ? REMEMBER_TTL_MS : SESSION_TTL_MS) / 1000,
  }
}

/** The session cookie's value in a request's Cookie header, if any. */
export function adminSessionFromCookies(cookieHeader: string | null): string | null {
  for (const part of (cookieHeader ?? '').split(';')) {
    const eq = part.indexOf('=')
    if (eq !== -1 && part.slice(0, eq).trim() === ADMIN_SESSION_COOKIE) return part.slice(eq + 1).trim() || null
  }
  return null
}

/** When a valid token expires (ms), or null when it isn't valid. */
export function adminSessionExpiry(token: string | null | undefined): number | null {
  const secret = getSecret()
  if (!secret || !token) return null

  const parts = token.split('.')
  if (parts.length !== 2) return null
  const [payloadB64, signature] = parts

  const expected = sign(payloadB64, secret)
  const a = Buffer.from(signature)
  const b = Buffer.from(expected)
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null

  try {
    const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8'))
    return typeof payload.exp === 'number' && payload.exp > Date.now() ? payload.exp : null
  } catch {
    return null
  }
}

export function verifyAdminSessionToken(token: string | null | undefined): boolean {
  return adminSessionExpiry(token) !== null
}

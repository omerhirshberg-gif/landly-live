import 'server-only'
import { clientIp } from '@/lib/auth/clientIp'
import { NextResponse } from 'next/server'
import { isAdminPassword } from './checkAdminPassword'
import { releaseAdminLoginAttempt, reserveAdminLoginAttempt } from '@/lib/auth/adminLoginThrottle'
import { verifyAdminSessionToken } from './sessionToken'

// Two independent throttles:
//
//  - the login-attempt limiter guards password guessing on
//    /api/admin/verify-password specifically -- ADMIN_PASSWORD is a
//    human-typed, guessable secret. It lives in Firestore
//    (lib/auth/adminLoginThrottle.ts), per IP and across all IPs, so neither a cold
//    start nor another serverless instance resets it.
//  - the generic request limiter guards every /api/admin/* call, including
//    verify-password, against flooding/log-spam. It's in memory per process
//    (reset on cold start, not shared between instances -- a floor, not a
//    ceiling). It does NOT gate session-token verification on the other
//    routes: a token is a 256-bit HMAC-signed value, not guessable by
//    repeated submission, and every legitimate session naturally produces
//    expired-token 401s in normal use (the next click after the token's 12h
//    expiry, a stale background tab) -- counting those against a
//    brute-force budget would risk locking out a real admin for ordinary
//    use while adding no real protection against guessing.
const REQUEST_WINDOW_MS = 60 * 1000
const REQUEST_MAX = 60
const requestCounts = new Map<string, { count: number; resetAt: number }>()

function isOverRequestLimit(ip: string): boolean {
  const now = Date.now()
  const entry = requestCounts.get(ip)
  if (!entry || now > entry.resetAt) {
    requestCounts.set(ip, { count: 1, resetAt: now + REQUEST_WINDOW_MS })
    return false
  }
  entry.count += 1
  return entry.count > REQUEST_MAX
}

function tooManyAttempts(): NextResponse {
  return NextResponse.json({ error: 'Too many attempts. Try again later.' }, { status: 429 })
}

function tooManyRequests(): NextResponse {
  return NextResponse.json({ error: 'Too many requests. Try again later.' }, { status: 429 })
}

// Shared by every /api/admin/* route that takes a session token as a
// Bearer header (every admin route except verify-password itself). Returns
// the response to send back verbatim, or null if the request is authorized
// and the route should proceed.
export function requireAdminAuth(request: Request): NextResponse | null {
  const ip = clientIp(request)
  if (isOverRequestLimit(ip)) return tooManyRequests()

  const authHeader = request.headers.get('authorization') ?? ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice('Bearer '.length) : null
  return verifyAdminSessionToken(token) ? null : NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
}

// For /api/admin/verify-password: the actual login attempt, gated by both
// the generic flood guard and the password-guessing throttle. The attempt is
// counted before the password is compared; an unreachable throttle refuses
// the login rather than letting guesses through uncounted.
export async function checkAdminPasswordWithRateLimit(request: Request, password: string | null): Promise<NextResponse | null> {
  const ip = clientIp(request)
  if (isOverRequestLimit(ip)) return tooManyRequests()

  let allowed: boolean
  try {
    allowed = await reserveAdminLoginAttempt(ip)
  } catch (err) {
    console.error('admin login throttle unavailable', (err as { code?: unknown })?.code ?? 'unknown')
    return NextResponse.json({ error: 'Service unavailable. Try again later.' }, { status: 503 })
  }
  if (!allowed) return tooManyAttempts()

  if (!isAdminPassword(password)) return NextResponse.json({ ok: false }, { status: 401 })
  await releaseAdminLoginAttempt(ip).catch((err) => console.error('admin login throttle release failed', (err as { code?: unknown })?.code ?? 'unknown'))
  return null
}

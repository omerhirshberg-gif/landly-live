import 'server-only'
import { clientIp } from '@/lib/auth/clientIp'
import { NextResponse } from 'next/server'
import { isAdminPassword } from './checkAdminPassword'
import { verifyAdminSessionToken } from './sessionToken'

// Two independent, in-memory-per-process throttles (both reset on cold
// start/restart and aren't shared across instances -- a floor, not a
// ceiling; a durable store or platform-level rate limiting would be the
// real fix if this ever needs to hold up against a distributed attempt):
//
//  - the login-attempt limiter guards password guessing on
//    /api/admin/verify-password specifically -- ADMIN_PASSWORD is a
//    human-typed, guessable secret.
//  - the generic request limiter guards every /api/admin/* call, including
//    verify-password, against flooding/log-spam. It does NOT gate session-
//    token verification on the other 6 routes: a token is a 256-bit
//    HMAC-signed value, not guessable by repeated submission, and every
//    legitimate session naturally produces expired-token 401s in normal
//    use (the next click after the token's 12h expiry, a stale background
//    tab) -- counting those against a brute-force budget would risk
//    locking out a real admin for ordinary use while adding no real
//    protection against guessing.
const LOGIN_WINDOW_MS = 15 * 60 * 1000
const LOGIN_MAX_ATTEMPTS = 10
const loginAttempts = new Map<string, { count: number; resetAt: number }>()

const REQUEST_WINDOW_MS = 60 * 1000
const REQUEST_MAX = 60
const requestCounts = new Map<string, { count: number; resetAt: number }>()

function isLoginRateLimited(ip: string): boolean {
  const entry = loginAttempts.get(ip)
  if (!entry || Date.now() > entry.resetAt) return false
  return entry.count >= LOGIN_MAX_ATTEMPTS
}

function recordLoginAttempt(ip: string, success: boolean): void {
  if (success) {
    loginAttempts.delete(ip)
    return
  }
  const now = Date.now()
  const entry = loginAttempts.get(ip)
  if (!entry || now > entry.resetAt) {
    loginAttempts.set(ip, { count: 1, resetAt: now + LOGIN_WINDOW_MS })
  } else {
    entry.count += 1
  }
}

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
// the generic flood guard and the password-guessing throttle.
export function checkAdminPasswordWithRateLimit(request: Request, password: string | null): NextResponse | null {
  const ip = clientIp(request)
  if (isOverRequestLimit(ip)) return tooManyRequests()
  if (isLoginRateLimited(ip)) return tooManyAttempts()

  const ok = isAdminPassword(password)
  recordLoginAttempt(ip, ok)
  return ok ? null : NextResponse.json({ ok: false }, { status: 401 })
}

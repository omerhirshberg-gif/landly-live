import 'server-only'
import { createHash, randomBytes } from 'node:crypto'
import { clientIp } from '@/lib/auth/clientIp'

// The single-use token in the "confirm your new email" link. Only its
// SHA-256 lives in emailChangeRequests/{uid} (server-only), so reading the
// database never yields a working link; the member's own users/{uid} doc
// carries the pending address but never the token, or they could confirm an
// inbox they don't own.

export const EMAIL_CHANGE_TTL_MS = 24 * 60 * 60 * 1000
/** "Resend email" waits this long between sends. */
export const EMAIL_CHANGE_RESEND_COOLDOWN_MS = 60 * 1000
/** Changing the address needs a sign-in (password re-entry) this recent. */
export const RECENT_SIGN_IN_SECONDS = 5 * 60

export function createEmailChangeToken(): { token: string; tokenHash: string } {
  const token = randomBytes(32).toString('base64url')
  return { token, tokenHash: hashEmailChangeToken(token) }
}

export function hashEmailChangeToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

/** 32 random bytes in base64url. */
export const isEmailChangeToken = (value: unknown): value is string => typeof value === 'string' && /^[A-Za-z0-9_-]{43}$/.test(value)

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** Trimmed and lowercased, or null when it isn't a plausible address. */
export function normalizeEmail(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const email = value.trim().toLowerCase()
  return email.length <= 254 && EMAIL_PATTERN.test(email) ? email : null
}

// The confirm link is opened signed out, so it's capped per IP instead of per
// account. Same per-process caveats as lib/auth/verificationRateLimit.ts; the
// 256-bit token is the real guard.
const CONFIRM_WINDOW_MS = 15 * 60 * 1000
const MAX_CONFIRMS_PER_IP = 20
const confirms = new Map<string, { count: number; resetAt: number }>()

export function isEmailChangeConfirmRateLimited(request: Request): boolean {
  const ip = clientIp(request)
  const now = Date.now()
  const entry = confirms.get(ip)
  if (!entry || now > entry.resetAt) {
    confirms.set(ip, { count: 1, resetAt: now + CONFIRM_WINDOW_MS })
    return false
  }
  entry.count += 1
  return entry.count > MAX_CONFIRMS_PER_IP
}

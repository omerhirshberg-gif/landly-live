import 'server-only'

// Throttle for /api/auth/send-verification. Same in-memory-per-process shape
// (and same caveats: resets on cold start, not shared across serverless
// instances) as lib/auth/passwordResetRateLimit.ts. The real abuse guard is
// that the endpoint only ever mails the address on the caller's own verified
// ID token -- so you need the account's password to trigger a send at all.
// These limits just cap how often that one account's inbox can be hit.
const WINDOW_MS = 15 * 60 * 1000
const MAX_PER_IP = 10
const MAX_PER_UID = 5
const UID_COOLDOWN_MS = 60 * 1000

const ipCounts = new Map<string, { count: number; resetAt: number }>()
const uidSends = new Map<string, { count: number; resetAt: number; lastSentAt: number }>()

function clientIp(request: Request): string {
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
}

export function isVerificationIpRateLimited(request: Request): boolean {
  const ip = clientIp(request)
  const now = Date.now()
  const entry = ipCounts.get(ip)
  if (!entry || now > entry.resetAt) {
    ipCounts.set(ip, { count: 1, resetAt: now + WINDOW_MS })
    return false
  }
  entry.count += 1
  return entry.count > MAX_PER_IP
}

/** Records a send for `uid` and returns true if it should be refused instead. */
export function isVerificationUidRateLimited(uid: string): boolean {
  const now = Date.now()
  const entry = uidSends.get(uid)
  if (!entry || now > entry.resetAt) {
    uidSends.set(uid, { count: 1, resetAt: now + WINDOW_MS, lastSentAt: now })
    return false
  }
  if (now - entry.lastSentAt < UID_COOLDOWN_MS || entry.count >= MAX_PER_UID) return true
  entry.count += 1
  entry.lastSentAt = now
  return false
}

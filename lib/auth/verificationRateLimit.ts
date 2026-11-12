import 'server-only'
import { clientIp } from '@/lib/auth/clientIp'
import { isDurablyLimited } from '@/lib/auth/durableRateLimit.server'

// Throttle for /api/auth/send-verification. Same shape as
// lib/auth/passwordResetRateLimit.ts: an in-memory count first, then the same
// window in Firestore (durableRateLimit.server.ts). The real abuse guard is
// that the endpoint only ever mails the address on the caller's own verified
// ID token -- so you need the account's password to trigger a send at all.
// These limits just cap how often that one account's inbox can be hit.
const WINDOW_MS = 15 * 60 * 1000
const MAX_PER_IP = 10
const MAX_PER_UID = 5
const UID_COOLDOWN_MS = 60 * 1000

const ipCounts = new Map<string, { count: number; resetAt: number }>()
const uidSends = new Map<string, { count: number; resetAt: number; lastSentAt: number }>()

export async function isVerificationIpRateLimited(request: Request): Promise<boolean> {
  const ip = clientIp(request)
  const now = Date.now()
  const entry = ipCounts.get(ip)
  if (!entry || now > entry.resetAt) ipCounts.set(ip, { count: 1, resetAt: now + WINDOW_MS })
  else {
    entry.count += 1
    if (entry.count > MAX_PER_IP) return true
  }
  return isDurablyLimited({ scope: 'verification-ip', key: ip, max: MAX_PER_IP, windowMs: WINDOW_MS })
}

/** Records a send for `uid` and returns true if it should be refused instead. */
export async function isVerificationUidRateLimited(uid: string): Promise<boolean> {
  const now = Date.now()
  const entry = uidSends.get(uid)
  if (!entry || now > entry.resetAt) uidSends.set(uid, { count: 1, resetAt: now + WINDOW_MS, lastSentAt: now })
  else {
    if (now - entry.lastSentAt < UID_COOLDOWN_MS || entry.count >= MAX_PER_UID) return true
    entry.count += 1
    entry.lastSentAt = now
  }
  return isDurablyLimited({ scope: 'verification-uid', key: uid, max: MAX_PER_UID, windowMs: WINDOW_MS })
}

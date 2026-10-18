import 'server-only'
import { clientIp } from '@/lib/auth/clientIp'

// In-memory-per-process throttles for the public contact forms, same shape as
// passwordResetRateLimit.ts: every request sends one email to the team inbox,
// so this is a floor against casual flooding, not a ceiling. Each form keeps
// its own counts.
const WINDOW_MS = 15 * 60 * 1000
const MAX_REQUESTS = 5

function createKeyLimiter(max: number): (key: string) => boolean {
  const requestCounts = new Map<string, { count: number; resetAt: number }>()
  return (key) => {
    const now = Date.now()
    const entry = requestCounts.get(key)
    if (!entry || now > entry.resetAt) {
      requestCounts.set(key, { count: 1, resetAt: now + WINDOW_MS })
      return false
    }
    entry.count += 1
    return entry.count > max
  }
}

function createLimiter(): (request: Request) => boolean {
  const byIp = createKeyLimiter(MAX_REQUESTS)
  return (request) => byIp(clientIp(request))
}

export const isSupportMessageRateLimited = createLimiter()
export const isBusinessInquiryRateLimited = createLimiter()
export const isMentorRequestRateLimited = createLimiter()
export const isDeletionRequestRateLimited = createLimiter()
// The deletion and mentor forms are signed in, so they're also capped per
// account, which an attacker can't rotate the way they can an IP.
export const isDeletionRequestUidRateLimited = createKeyLimiter(3)
export const isMentorRequestUidRateLimited = createKeyLimiter(3)

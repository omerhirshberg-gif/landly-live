import 'server-only'
import { clientIp } from '@/lib/auth/clientIp'
import { isDurablyLimited } from '@/lib/auth/durableRateLimit.server'

// Throttles for the contact forms, same shape as passwordResetRateLimit.ts: an
// in-memory count first, then the same window in Firestore
// (durableRateLimit.server.ts). Every request sends one email to the team
// inbox. Each form keeps its own counts.
const WINDOW_MS = 15 * 60 * 1000
const MAX_REQUESTS = 5

function createKeyLimiter(scope: string, max: number): (key: string) => Promise<boolean> {
  const requestCounts = new Map<string, { count: number; resetAt: number }>()
  return async (key) => {
    const now = Date.now()
    const entry = requestCounts.get(key)
    if (!entry || now > entry.resetAt) requestCounts.set(key, { count: 1, resetAt: now + WINDOW_MS })
    else {
      entry.count += 1
      if (entry.count > max) return true
    }
    // The same budget in Firestore, so another instance or a cold start can't reset it.
    return isDurablyLimited({ scope, key, max, windowMs: WINDOW_MS })
  }
}

function createLimiter(scope: string): (request: Request) => Promise<boolean> {
  const byIp = createKeyLimiter(scope, MAX_REQUESTS)
  return (request) => byIp(clientIp(request))
}

export const isSupportMessageRateLimited = createLimiter('support')
export const isBusinessInquiryRateLimited = createLimiter('business-inquiry')
export const isMentorRequestRateLimited = createLimiter('mentor-request')
export const isDeletionRequestRateLimited = createLimiter('deletion-request')
// The deletion and mentor forms are signed in, so they're also capped per
// account, which an attacker can't rotate the way they can an IP.
export const isDeletionRequestUidRateLimited = createKeyLimiter('deletion-request-uid', 3)
export const isMentorRequestUidRateLimited = createKeyLimiter('mentor-request-uid', 3)

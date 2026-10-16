import 'server-only'
import { clientIp } from '@/lib/auth/clientIp'

// In-memory-per-process throttles for the public contact forms, same shape as
// passwordResetRateLimit.ts: every request sends one email to the team inbox,
// so this is a floor against casual flooding, not a ceiling. Each form keeps
// its own counts.
const WINDOW_MS = 15 * 60 * 1000
const MAX_REQUESTS = 5

function createLimiter(): (request: Request) => boolean {
  const requestCounts = new Map<string, { count: number; resetAt: number }>()
  return (request) => {
    const ip = clientIp(request)
    const now = Date.now()
    const entry = requestCounts.get(ip)
    if (!entry || now > entry.resetAt) {
      requestCounts.set(ip, { count: 1, resetAt: now + WINDOW_MS })
      return false
    }
    entry.count += 1
    return entry.count > MAX_REQUESTS
  }
}

export const isSupportMessageRateLimited = createLimiter()
export const isBusinessInquiryRateLimited = createLimiter()
export const isMentorRequestRateLimited = createLimiter()

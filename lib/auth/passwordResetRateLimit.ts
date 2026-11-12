import 'server-only'
import { clientIp } from '@/lib/auth/clientIp'
import { isDurablyLimited } from '@/lib/auth/durableRateLimit.server'

// In-memory-per-process throttle for the public /api/auth/forgot-password
// endpoint, same shape as the generic request limiter in
// lib/admin/adminAuth.ts. Deliberately stricter than that one (5/15min vs
// 60/min) since this endpoint is unauthenticated and triggers an outbound
// email per request -- a floor against casual email-bombing of one address
// or scraping across many. The per-process count is the cheap first check;
// the same window then holds in Firestore (durableRateLimit.server.ts), so a
// cold start or another instance can't hand out a fresh budget.
const WINDOW_MS = 15 * 60 * 1000
const MAX_REQUESTS = 5
const requestCounts = new Map<string, { count: number; resetAt: number }>()

export async function isPasswordResetRateLimited(request: Request): Promise<boolean> {
  const ip = clientIp(request)
  const now = Date.now()
  const entry = requestCounts.get(ip)
  if (!entry || now > entry.resetAt) {
    requestCounts.set(ip, { count: 1, resetAt: now + WINDOW_MS })
    return isDurablyLimited({ scope: 'password-reset', key: ip, max: MAX_REQUESTS, windowMs: WINDOW_MS })
  }
  entry.count += 1
  if (entry.count > MAX_REQUESTS) return true
  return isDurablyLimited({ scope: 'password-reset', key: ip, max: MAX_REQUESTS, windowMs: WINDOW_MS })
}

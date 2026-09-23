import 'server-only'
import { clientIp } from '@/lib/auth/clientIp'

// In-memory-per-process throttle for the public /api/auth/forgot-password
// endpoint, same shape as the generic request limiter in
// lib/admin/adminAuth.ts. Deliberately stricter than that one (5/15min vs
// 60/min) since this endpoint is unauthenticated and triggers an outbound
// email per request -- a floor against casual email-bombing of one address
// or scraping across many, not a ceiling. Resets on cold start/restart and
// isn't shared across serverless instances; a durable store would be the
// real fix if this ever needs to hold up against a distributed attempt.
const WINDOW_MS = 15 * 60 * 1000
const MAX_REQUESTS = 5
const requestCounts = new Map<string, { count: number; resetAt: number }>()

export function isPasswordResetRateLimited(request: Request): boolean {
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

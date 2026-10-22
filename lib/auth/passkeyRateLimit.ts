import 'server-only'
import { clientIp } from '@/lib/auth/clientIp'

// Per-IP fixed windows for the public passkey sign-in routes, same shape as
// passwordResetRateLimit.ts (per process, reset on cold start). Options are
// fetched on every visit to the sign-in tab (the email field's autofill), so
// that budget is generous; verifying is the one an attacker would hammer.
const WINDOW_MS = 60 * 1000
const LIMITS = { options: 60, verify: 20 } as const
const counts = { options: new Map<string, { count: number; resetAt: number }>(), verify: new Map<string, { count: number; resetAt: number }>() }

export function isPasskeyRateLimited(scope: keyof typeof LIMITS, request: Request, now = Date.now()): boolean {
  const ip = clientIp(request)
  const entries = counts[scope]
  for (const [key, entry] of entries) if (now >= entry.resetAt) entries.delete(key)
  const entry = entries.get(ip)
  if (!entry) {
    entries.set(ip, { count: 1, resetAt: now + WINDOW_MS })
    return false
  }
  entry.count += 1
  return entry.count > LIMITS[scope]
}

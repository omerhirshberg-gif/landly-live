import 'server-only'
import { clientIp } from '@/lib/auth/clientIp'

// In-memory, per process: a floor against one client running up Geocoding
// calls by walking coordinates, not a ceiling (cache hits don't count, and
// the Cloud Console's daily quota is the real cap).
const WINDOW_MS = 10 * 60 * 1000

export function createIpRateLimiter(max: number): (request: Request) => boolean {
  const counts = new Map<string, { count: number; resetAt: number }>()
  return (request) => {
    const key = clientIp(request)
    const now = Date.now()
    const entry = counts.get(key)
    if (!entry || now > entry.resetAt) {
      counts.set(key, { count: 1, resetAt: now + WINDOW_MS })
      return false
    }
    entry.count += 1
    return entry.count > max
  }
}

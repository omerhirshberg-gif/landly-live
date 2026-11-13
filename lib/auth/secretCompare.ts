import 'server-only'
import { createHash, timingSafeEqual } from 'node:crypto'

/**
 * Constant-time string equality that also hides the length: both sides are
 * hashed to 32 bytes first, so timingSafeEqual never sees (or branches on)
 * differing lengths. For comparing a caller's guess with a configured secret.
 */
export function secretsEqual(candidate: string, expected: string): boolean {
  const a = createHash('sha256').update(candidate).digest()
  const b = createHash('sha256').update(expected).digest()
  return timingSafeEqual(a, b)
}

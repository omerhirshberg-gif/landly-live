import 'server-only'
import { createHmac, timingSafeEqual } from 'node:crypto'

// Stateless one-click unsubscribe credential: base64url(payload).base64url(HMAC-SHA256).
// The payload is just the lowercase email and a version, so the link works
// without a login and without a lookup table. It never expires: an old
// email's link must keep working (Israel's Anti-Spam Law, section 30a), and
// the only thing a valid token can do is opt that one address out.
//
// Signed with UNSUBSCRIBE_SECRET, falling back to ADMIN_SESSION_SECRET under
// a domain-separation prefix, so the two uses never share a signature.

const VERSION = 1
const DOMAIN_PREFIX = 'newsletter-unsub:v1:'

function secret(): string {
  const dedicated = process.env.UNSUBSCRIBE_SECRET
  if (dedicated) return dedicated
  const fallback = process.env.ADMIN_SESSION_SECRET
  if (fallback) return `${DOMAIN_PREFIX}${fallback}`
  throw new Error('UNSUBSCRIBE_SECRET is not configured.')
}

const sign = (payload: string) => createHmac('sha256', secret()).update(payload).digest('base64url')

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

export function createUnsubscribeToken(email: string): string {
  const payload = Buffer.from(JSON.stringify({ e: normalizeEmail(email), v: VERSION })).toString('base64url')
  return `${payload}.${sign(payload)}`
}

/** The lowercase email a token was issued for, or null when it is malformed, forged or from another version. */
export function verifyUnsubscribeToken(token: unknown): string | null {
  if (typeof token !== 'string' || token.length > 1024) return null
  const [payload, signature, extra] = token.split('.')
  if (!payload || !signature || extra !== undefined) return null
  let expected: Buffer
  try {
    expected = Buffer.from(sign(payload))
  } catch {
    return null
  }
  const given = Buffer.from(signature)
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as { e?: unknown; v?: unknown }
    return data.v === VERSION && typeof data.e === 'string' && data.e.includes('@') ? data.e : null
  } catch {
    return null
  }
}

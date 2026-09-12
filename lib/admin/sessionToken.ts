import 'server-only'
import { createHmac, timingSafeEqual } from 'node:crypto'

// Signed, expiring credential issued by /api/admin/verify-password after a
// correct ADMIN_PASSWORD check (see checkAdminPassword.ts, unchanged), so
// the client only ever needs the raw password once, at login, instead of
// holding and resending it on every request. Signed with its own secret
// (ADMIN_SESSION_SECRET) rather than ADMIN_PASSWORD itself, so leaking one
// doesn't leak the other, and so all outstanding sessions can be force-
// invalidated by rotating this secret without touching the login password.
const SESSION_TTL_MS = 12 * 60 * 60 * 1000

function getSecret(): string | undefined {
  return process.env.ADMIN_SESSION_SECRET
}

function sign(payloadB64: string, secret: string): string {
  return createHmac('sha256', secret).update(payloadB64).digest('base64url')
}

// Throws rather than silently issuing an unverifiable token -- a missing
// secret should fail loudly at login, not manifest later as "login works
// but every subsequent admin call 401s" with no obvious cause.
export function issueAdminSessionToken(): string {
  const secret = getSecret()
  if (!secret) throw new Error('ADMIN_SESSION_SECRET is not configured.')

  const payload = { exp: Date.now() + SESSION_TTL_MS }
  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString('base64url')
  return `${payloadB64}.${sign(payloadB64, secret)}`
}

export function verifyAdminSessionToken(token: string | null | undefined): boolean {
  const secret = getSecret()
  if (!secret || !token) return false

  const parts = token.split('.')
  if (parts.length !== 2) return false
  const [payloadB64, signature] = parts

  const expected = sign(payloadB64, secret)
  const a = Buffer.from(signature)
  const b = Buffer.from(expected)
  if (a.length !== b.length || !timingSafeEqual(a, b)) return false

  try {
    const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8'))
    return typeof payload.exp === 'number' && payload.exp > Date.now()
  } catch {
    return false
  }
}

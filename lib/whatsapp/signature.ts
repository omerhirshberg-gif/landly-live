import 'server-only'
import { createHash, createHmac, timingSafeEqual } from 'node:crypto'

// Meta signs every webhook POST with the app secret: x-hub-signature-256 is
// "sha256=" + the hex HMAC-SHA256 of the raw request bytes. The body must be
// checked exactly as it arrived, before any JSON parsing.
export function verifyMetaSignature(rawBody: Buffer, header: string | null, appSecret: string): boolean {
  if (!appSecret || !header?.startsWith('sha256=')) return false
  const hex = header.slice('sha256='.length)
  if (!/^[0-9a-f]{64}$/i.test(hex)) return false
  const expected = createHmac('sha256', appSecret).update(rawBody).digest()
  return timingSafeEqual(Buffer.from(hex, 'hex'), expected)
}

// The GET subscription handshake's hub.verify_token, compared in constant
// time (hashed first, so different lengths don't short-circuit).
export function verifyTokenMatches(given: string | null, expected: string): boolean {
  if (!given || !expected) return false
  const digest = (value: string) => createHash('sha256').update(value).digest()
  return timingSafeEqual(digest(given), digest(expected))
}

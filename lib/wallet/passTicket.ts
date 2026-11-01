import 'server-only'
import { createHmac, timingSafeEqual } from 'node:crypto'

// Opening a .pkpass has to be a plain navigation: that's what iOS turns into
// Wallet's preview, and a navigation can't carry the Bearer ID token every API
// route authorizes with. So the authenticated POST hands out this ticket, good
// for one voucher and one member for 60 seconds, and the GET takes it instead.
// Stateless: it can be used more than once inside its minute, which only ever
// gets its own owner's pass; the GET re-reads the voucher every time.

export const TICKET_TTL_SECONDS = 60

const sign = (secret: string, voucherId: string, uid: string, expiresAt: number) =>
  createHmac('sha256', secret).update(`landly-wallet-ticket:v1:${voucherId}:${uid}:${expiresAt}`).digest('base64url')

export function createPassTicket(secret: string, voucherId: string, uid: string, nowMs = Date.now()): string {
  const expiresAt = Math.floor(nowMs / 1000) + TICKET_TTL_SECONDS
  return `${expiresAt}.${uid}.${sign(secret, voucherId, uid, expiresAt)}`
}

/** The member the ticket was issued to, or null if it's malformed, forged, expired or for another voucher. */
export function verifyPassTicket(secret: string, ticket: string | null, voucherId: string, nowMs = Date.now()): string | null {
  const match = ticket?.match(/^(\d{1,12})\.([\w-]{1,128})\.([\w-]+)$/)
  if (!match) return null
  const [, expiry, uid, signature] = match
  const expiresAt = Number(expiry)
  const given = Buffer.from(signature)
  const expected = Buffer.from(sign(secret, voucherId, uid, expiresAt))
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null
  return expiresAt * 1000 > nowMs ? uid : null
}

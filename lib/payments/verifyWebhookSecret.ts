import 'server-only'
import { timingSafeEqual } from 'node:crypto'

// Placeholder gate for the Tranzila webhook until real Tranzila credentials
// and their actual signature scheme are available — same shared-secret
// pattern as lib/admin/checkAdminPassword.ts, applied to a different secret
// (TRANZILA_WEBHOOK_SECRET) so admin access and payment-webhook access stay
// independently rotatable.
export function isTranzilaWebhookSecret(candidate: string | null | undefined): boolean {
  const expected = process.env.TRANZILA_WEBHOOK_SECRET
  if (!expected || !candidate) return false

  const a = Buffer.from(candidate)
  const b = Buffer.from(expected)
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}

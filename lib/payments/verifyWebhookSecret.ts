import 'server-only'
import { secretsEqual } from '@/lib/auth/secretCompare'

// Application-specific gate, NOT a confirmed Tranzila signature scheme.
// Keep fail-closed until actual notification transport/authentication is
// verified with Tranzila support or terminal documentation before go-live.
// Never put this secret in the client payment form or its custom fields.
export function isTranzilaWebhookSecret(candidate: string | null | undefined): boolean {
  const expected = process.env.TRANZILA_WEBHOOK_SECRET
  if (!expected || !candidate) return false
  return secretsEqual(candidate, expected)
}

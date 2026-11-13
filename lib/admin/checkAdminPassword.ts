import 'server-only'
import { secretsEqual } from '@/lib/auth/secretCompare'

// Shared by every /api/admin/* route so the password check is enforced
// server-side on each request, independent of the client-side sessionStorage
// gate (which only controls UI navigation, not API access).
export function isAdminPassword(candidate: string | null | undefined): boolean {
  const expected = process.env.ADMIN_PASSWORD
  if (!expected || !candidate) return false
  return secretsEqual(candidate, expected)
}

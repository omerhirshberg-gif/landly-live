import 'server-only'

// An email change from the profile screens is verified with a 6-digit code
// sent to the new address, the same engine as a phone change
// (./phoneVerification.ts: generateOtp, hashOtp, otpMatches, its TTL,
// attempt cap and resend cooldown). Only the code's salted hash lives in
// emailChangeRequests/{uid} (server-only), so reading the database never
// yields a working code; the member's own users/{uid} doc carries the
// pending address but never the code, or they could confirm an inbox they
// don't own.

/** Changing the address needs a sign-in (password re-entry) this recent. */
export const RECENT_SIGN_IN_SECONDS = 5 * 60

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** Trimmed and lowercased, or null when it isn't a plausible address. */
export function normalizeEmail(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const email = value.trim().toLowerCase()
  return email.length <= 254 && EMAIL_PATTERN.test(email) ? email : null
}

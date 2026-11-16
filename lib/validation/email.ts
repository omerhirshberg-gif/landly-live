// The one email shape check for the whole product (web, server routes and the
// native app through @shared/validation/email). Pure and client-safe: no
// server-only, no node modules.
//
// Shape: a local part with no whitespace or header-breaking characters, then a
// domain of dot-separated labels ending in a TLD of two or more letters (or a punycode xn-- one), so
// modern TLDs (.tech, .online, .co.il) pass and "a@b.c" does not. Whether the
// domain can actually receive mail is a server question (lib/validation/emailDns.server.ts).

const EMAIL_RE = /^[^\s@<>()[\]\\,;:\"]+@(?:[a-z0-9¡-￿](?:[a-z0-9¡-￿-]*[a-z0-9¡-￿])?\.)+(?:[a-z¡-￿]{2,}|xn--[a-z0-9-]{2,})$/i

export const MAX_EMAIL_LENGTH = 254

/** Trimmed and lowercased, or null when it isn't a valid address. */
export function normalizeEmail(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const email = value.trim().toLowerCase()
  return isValidEmail(email) ? email : null
}

export function isValidEmail(value: string, maxLength: number = MAX_EMAIL_LENGTH): boolean {
  return typeof value === 'string' && value.length <= maxLength && EMAIL_RE.test(value)
}

/** The part after the last "@", lowercased, or '' when there is none. */
export function emailDomain(email: string): string {
  const at = email.lastIndexOf('@')
  return at < 0 ? '' : email.slice(at + 1).trim().toLowerCase()
}

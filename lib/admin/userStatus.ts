// Pure helpers for the admin Users console. No role field exists on a member:
// admin is a server session and a merchant is a `businesses/{uid}` account.

export const USER_STATUSES = ['active', 'suspended', 'banned'] as const
export type UserStatus = (typeof USER_STATUSES)[number]
export const parseUserStatus = (value: unknown): UserStatus => (value === 'suspended' || value === 'banned' ? value : 'active')

export type KycTier = 'guest' | 'verified_phone' | 'full'

/** guest: nothing verified; verified_phone: a confirmed WhatsApp number; full: that plus a verified email. */
export function kycTierOf(emailVerified: boolean, phoneVerified: boolean): KycTier {
  if (phoneVerified && emailVerified) return 'full'
  return phoneVerified ? 'verified_phone' : 'guest'
}

/**
 * A short, stable, support-friendly code derived from the uid (never stored,
 * so nothing to backfill). A lookup aid, not a secret: plain FNV-1a so the
 * browser can compute it for search too.
 */
export function passIdFor(uid: string): string {
  const alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
  let a = 0x811c9dc5
  let b = 0x01000193 ^ 0x9e3779b9
  for (let i = 0; i < uid.length; i++) {
    a = Math.imul(a ^ uid.charCodeAt(i), 0x01000193) >>> 0
    b = Math.imul(b ^ uid.charCodeAt(uid.length - 1 - i), 0x85ebca6b) >>> 0
  }
  let id = ''
  for (let i = 0; i < 6; i++) {
    const word = i < 3 ? a : b
    id += alphabet[((word >>> ((i % 3) * 8)) & 0xff) % alphabet.length]
  }
  return `LND-${id}`
}

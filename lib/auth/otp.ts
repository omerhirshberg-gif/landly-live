// The phone-change code shared by the website, the app and the API routes
// (the server side lives in ./phoneVerification.ts, which is server-only).
// The channel follows the number (lib/auth/otpChannel.ts): SMS for Israeli
// (+972) numbers, WhatsApp for every other country -- most members (olim,
// tourists, Taglit and Masa participants, lone soldiers) keep a non-Israeli
// number, and WhatsApp reaches them without per-country SMS routing.

export type OtpChannel = 'whatsapp' | 'sms'

export const OTP_LENGTH = 6

/** The resend button counts down this long after each send. */
export const OTP_RESEND_SECONDS = 60

export const isOtpChannel = (value: unknown): value is OtpChannel => value === 'whatsapp' || value === 'sms'

export const isOtpCode = (value: unknown): value is string => typeof value === 'string' && /^\d{6}$/.test(value)

/**
 * What a typed, pasted or autofilled code becomes: its digits only, at most
 * six, so "123 456", "123-456" or "Your code is 123456" all paste cleanly.
 */
export function normalizeOtpInput(raw: string): string {
  return raw.replace(/\D/g, '').slice(0, OTP_LENGTH)
}

/**
 * The next value of a code field after an edit. Typing, deleting and an OS
 * autofill arrive as the whole new text, so their digits are the answer. A
 * paste lands after the digits already there ("12" + "482 913" reads
 * "12482913"): when the field then holds more than a code and still begins
 * with the old value, only what was added counts, so the paste replaces a
 * partial code instead of running into it.
 */
export function mergeOtpInput(prev: string, raw: string): string {
  const digits = raw.replace(/\D/g, '')
  if (digits.length <= OTP_LENGTH) return digits
  if (prev && digits.startsWith(prev) && digits.length - prev.length > 1) return digits.slice(prev.length, prev.length + OTP_LENGTH)
  return digits.slice(0, OTP_LENGTH)
}

/** The resend countdown as minutes and seconds: 60 -> "1:00", 42 -> "0:42". */
export function formatOtpCountdown(seconds: number): string {
  const total = Math.max(0, Math.ceil(seconds))
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`
}

/** What a verification dialog or sheet confirms: a pending phone number (WhatsApp) or a pending email address. */
export type OtpTarget = { kind: 'phone'; phone: string } | { kind: 'email'; email: string }

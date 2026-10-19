// The phone-change code shared by the website, the app and the API routes
// (the server side lives in ./phoneVerification.ts, which is server-only).
// WhatsApp is the primary channel: most members (olim, tourists, Taglit and
// Masa participants, lone soldiers) keep a non-Israeli number, and WhatsApp
// reaches every country without SMS routing or per-country pricing.

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

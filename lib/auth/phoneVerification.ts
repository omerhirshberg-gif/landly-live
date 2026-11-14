import 'server-only'
import { createHash, randomInt, timingSafeEqual } from 'node:crypto'
import type { Lang } from '@/lib/i18n/translations'
import { recordUsage } from '@/lib/usage/recordUsage'
import { Gateway019Error, gateway019ConfigProblem, gateway019Live, sendVia019Sms, sendVia019WhatsApp } from '@/lib/otp/gateway019'
import { OTP_LENGTH, OTP_RESEND_SECONDS, type OtpChannel } from './otp'

// Phone-change verification for the profile screens (web /profile, the app's
// Profile tab). A changed number waits in users/{uid}.pendingPhone until the
// member types the 6-digit code we sent them; the code's hash, expiry and
// attempt count live in phoneVerifications/{uid}, which no client can read.
//
// Whether a change is verified at all is one server-side switch, so the
// website and the app never disagree (/api/account/change-phone tells them):
//
// - production: PHONE_VERIFICATION_ENABLED=true (or the older
//   FIREBASE_PHONE_AUTH_ENABLED) verifies through gateway019Provider (019
//   delivers: an SMS to +972 numbers, a WhatsApp template to every other
//   country, lib/auth/otpChannel.ts); anything else saves the number
//   directly, as before -- nobody is blocked or left with a pending banner
//   that can never clear.
// - development and tests: verified through devProvider, which only logs the
//   code to the terminal (nothing is sent or billed), unless OTP_019_LIVE=true
//   and the 019 settings are complete; set the flag to "false" to save directly.
//
// Onboarding and sign-up still write the phone directly; this covers edits
// from the profile screens only.

export const OTP_TTL_MS = 10 * 60 * 1000
export const OTP_MAX_ATTEMPTS = 5
export const OTP_RESEND_COOLDOWN_MS = OTP_RESEND_SECONDS * 1000

export type PhoneVerificationMode = 'direct' | 'otp'

export interface OtpDispatch {
  /** E.164. */
  phone: string
  code: string
  channel: OtpChannel
  lang: Lang
}

export interface OtpProvider {
  readonly name: 'dev' | 'gateway019'
  send(dispatch: OtpDispatch): Promise<void>
}

/** The channel's provider refused or couldn't be reached; `code` is the provider's own error code. */
export class OtpDeliveryError extends Error {
  constructor(
    readonly channel: OtpChannel,
    readonly code: string,
    message: string
  ) {
    super(`OTP delivery via ${channel} failed: ${message}`)
    this.name = 'OtpDeliveryError'
  }
}

const isProduction = () => process.env.NODE_ENV === 'production'

export function phoneVerificationMode(): PhoneVerificationMode {
  // FIREBASE_PHONE_AUTH_ENABLED is the flag's earlier name, still honoured.
  const flag = process.env.PHONE_VERIFICATION_ENABLED || process.env.FIREBASE_PHONE_AUTH_ENABLED
  if (!isProduction()) return flag === 'false' ? 'direct' : 'otp'
  if (flag !== 'true') return 'direct'
  // Switched on but unable to send: saving directly beats a banner nobody can clear.
  const problem = gateway019ConfigProblem()
  if (problem) {
    console.error(`[phone-otp] PHONE_VERIFICATION_ENABLED is on but ${problem}; saving phone changes directly.`)
    return 'direct'
  }
  return 'otp'
}

export function otpProvider(): OtpProvider {
  return gateway019Live() ? gateway019Provider : devProvider
}

export function generateOtp(): string {
  return String(randomInt(0, 10 ** OTP_LENGTH)).padStart(OTP_LENGTH, '0')
}

// Salted with the uid, so the same code for two members never hashes alike.
export function hashOtp(uid: string, code: string): string {
  return createHash('sha256').update(`${uid}:${code}`).digest('hex')
}

export function otpMatches(uid: string, code: string, storedHash: string): boolean {
  const actual = Buffer.from(hashOtp(uid, code), 'hex')
  const expected = Buffer.from(storedHash, 'hex')
  return actual.length === expected.length && timingSafeEqual(actual, expected)
}

/** "+33 •••• 5678": enough to tell numbers apart in a log, never the whole number. */
export function maskPhone(phone: string): string {
  return phone.length > 6 ? `${phone.slice(0, 3)} •••• ${phone.slice(-4)}` : '••••'
}

// Simulated SMS / WhatsApp dispatch: the code goes to the `next dev` terminal only.
export const devProvider: OtpProvider = {
  name: 'dev',
  async send({ phone, code, channel }) {
    console.info(`[phone-otp] simulated ${channel === 'whatsapp' ? 'WhatsApp' : 'SMS'} to ${maskPhone(phone)}: code ${code}`)
    recordUsage('whatsapp.simulated')
  },
}

/** Delivery through 019: an SMS for an Israeli number, a WhatsApp template for any other. */
export const gateway019Provider: OtpProvider = {
  name: 'gateway019',
  async send({ phone, code, channel, lang }) {
    try {
      await (channel === 'sms' ? sendVia019Sms : sendVia019WhatsApp)({ phone, code, lang })
    } catch (err) {
      if (!(err instanceof Gateway019Error)) throw err
      console.error(`[phone-otp] 019 ${channel} delivery failed (${err.code}): ${err.message}`)
      throw new OtpDeliveryError(channel, err.code, err.message)
    }
  },
}

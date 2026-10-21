import 'server-only'
import { createHash, randomInt, timingSafeEqual } from 'node:crypto'
import type { Lang } from '@/lib/i18n/translations'
import { sendWhatsAppMessage, whatsappConfigProblem, whatsappLive, WhatsAppApiError } from '@/lib/whatsapp/graph'
import { OTP_LENGTH, OTP_RESEND_SECONDS, type OtpChannel } from './otp'

export { whatsappConfigProblem }

// Phone-change verification for the profile screens (web /profile, the app's
// Profile tab). A changed number waits in users/{uid}.pendingPhone until the
// member types the 6-digit code we sent them; the code's hash, expiry and
// attempt count live in phoneVerifications/{uid}, which no client can read.
//
// Whether a change is verified at all is one server-side switch, so the
// website and the app never disagree (/api/account/change-phone tells them):
//
// - production: PHONE_VERIFICATION_ENABLED=true (or the older
//   FIREBASE_PHONE_AUTH_ENABLED) verifies through productionProvider (Meta
//   WhatsApp Cloud API); anything else saves the number directly, as before --
//   nobody is blocked or left with a pending banner that can never clear.
// - development and tests: verified through devProvider, which only logs the
//   code to the terminal (no WhatsApp credits), unless WHATSAPP_OTP_LIVE=true
//   and the credentials are set; set the flag to "false" to save directly.
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
  readonly name: 'dev' | 'production'
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
  const problem = whatsappConfigProblem()
  if (problem) {
    console.error(`[phone-otp] PHONE_VERIFICATION_ENABLED is on but ${problem}; saving phone changes directly.`)
    return 'direct'
  }
  return 'otp'
}

export function otpProvider(): OtpProvider {
  return whatsappLive() ? productionProvider : devProvider
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

// Simulated WhatsApp dispatch: the code goes to the `next dev` terminal only.
export const devProvider: OtpProvider = {
  name: 'dev',
  async send({ phone, code, channel }) {
    console.info(`[phone-otp] simulated ${channel === 'whatsapp' ? 'WhatsApp' : 'SMS'} to ${maskPhone(phone)}: code ${code}`)
  },
}

export const productionProvider: OtpProvider = {
  name: 'production',
  async send(dispatch) {
    if (dispatch.channel === 'whatsapp') return sendWhatsAppOtp(dispatch)
    // The SMS hook: no SMS sender is contracted yet.
    throw new OtpDeliveryError('sms', 'not_configured', 'no SMS provider is configured')
  },
}

// Meta's approved "authentication" templates exist per language; the
// template is created in WhatsApp Manager under WHATSAPP_OTP_TEMPLATE in
// each of these. A language without an approved copy falls back to English
// (WHATSAPP_OTP_FALLBACK_LANGUAGE, for a template created as en_US).
const WHATSAPP_LANGUAGE: Record<Lang, string> = { en: 'en', he: 'he', ru: 'ru', fr: 'fr', es: 'es' }
const DEFAULT_OTP_TEMPLATE = 'landly_otp_code'

// Meta's template errors (132000 parameter count, 132001 no such template in
// that language, 132007 policy, 132012 parameter format, 132015/132016
// paused or disabled): another language's copy may still be fine.
const isTemplateError = (code: string) => /^1320\d\d$/.test(code)

// WhatsApp Cloud API: an authentication template whose body and copy-code
// button both carry the code (Meta requires the code in both parameters).
async function sendWhatsAppOtp({ phone, code, lang }: OtpDispatch): Promise<void> {
  const fallback = process.env.WHATSAPP_OTP_FALLBACK_LANGUAGE || 'en'
  const preferred = WHATSAPP_LANGUAGE[lang] ?? fallback
  try {
    await sendOtpTemplate(phone, code, preferred)
  } catch (err) {
    if (!(err instanceof WhatsAppApiError)) throw err
    if (preferred === fallback || !isTemplateError(err.code)) throw new OtpDeliveryError('whatsapp', err.code, err.message)
    console.warn(`[phone-otp] template unavailable in ${preferred} (${err.code}); retrying in ${fallback}`)
    await sendOtpTemplate(phone, code, fallback).catch((retry) => {
      throw retry instanceof WhatsAppApiError ? new OtpDeliveryError('whatsapp', retry.code, retry.message) : retry
    })
  }
}

function sendOtpTemplate(phone: string, code: string, language: string) {
  return sendWhatsAppMessage(phone, {
    type: 'template',
    template: {
      name: process.env.WHATSAPP_OTP_TEMPLATE || DEFAULT_OTP_TEMPLATE,
      language: { code: language },
      components: [
        { type: 'body', parameters: [{ type: 'text', text: code }] },
        { type: 'button', sub_type: 'url', index: '0', parameters: [{ type: 'text', text: code }] },
      ],
    },
  })
}

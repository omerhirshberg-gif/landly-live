import 'server-only'
import { createHash, randomInt, timingSafeEqual } from 'node:crypto'
import type { Lang } from '@/lib/i18n/translations'
import { OTP_LENGTH, OTP_RESEND_SECONDS, type OtpChannel } from './otp'

// Phone-change verification for the profile screens (web /profile, the app's
// Profile tab). A changed number waits in users/{uid}.pendingPhone until the
// member types the 6-digit code we sent them; the code's hash, expiry and
// attempt count live in phoneVerifications/{uid}, which no client can read.
//
// Whether a change is verified at all is one server-side switch, so the
// website and the app never disagree (/api/account/change-phone tells them):
//
// - production: FIREBASE_PHONE_AUTH_ENABLED=true verifies through
//   productionProvider (Meta WhatsApp Cloud API); anything else saves the
//   number directly, as before -- nobody is blocked or left with a pending
//   banner that can never clear (pre-Blaze / before the WhatsApp sender is live).
// - development and tests: verified through devProvider, which only logs the
//   code to the terminal (no SMS or WhatsApp credits); set the flag to
//   "false" to save directly instead.
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

/** Names the first missing WhatsApp Cloud API setting, or null when sending is configured. */
export function whatsappConfigProblem(): string | null {
  if (!process.env.WHATSAPP_ACCESS_TOKEN) return 'WHATSAPP_ACCESS_TOKEN is not configured'
  if (!process.env.WHATSAPP_PHONE_NUMBER_ID) return 'WHATSAPP_PHONE_NUMBER_ID is not configured'
  if (!process.env.WHATSAPP_OTP_TEMPLATE) return 'WHATSAPP_OTP_TEMPLATE is not configured'
  return null
}

export function phoneVerificationMode(): PhoneVerificationMode {
  const flag = process.env.FIREBASE_PHONE_AUTH_ENABLED
  if (!isProduction()) return flag === 'false' ? 'direct' : 'otp'
  if (flag !== 'true') return 'direct'
  // Switched on but unable to send: saving directly beats a banner nobody can clear.
  const problem = whatsappConfigProblem()
  if (problem) {
    console.error(`[phone-otp] FIREBASE_PHONE_AUTH_ENABLED is on but ${problem}; saving phone changes directly.`)
    return 'direct'
  }
  return 'otp'
}

export function otpProvider(): OtpProvider {
  return isProduction() ? productionProvider : devProvider
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

const WHATSAPP_TIMEOUT_MS = 10_000

// Meta's approved "authentication" templates exist per language; the
// template is created in WhatsApp Manager under WHATSAPP_OTP_TEMPLATE in
// each of these.
const WHATSAPP_LANGUAGE: Record<Lang, string> = { en: 'en', he: 'he', ru: 'ru', fr: 'fr', es: 'es' }

// WhatsApp Cloud API: an authentication template whose body and copy-code
// button both carry the code (Meta requires the code in both parameters).
async function sendWhatsAppOtp({ phone, code, lang }: OtpDispatch): Promise<void> {
  const problem = whatsappConfigProblem()
  if (problem) throw new OtpDeliveryError('whatsapp', 'not_configured', problem)
  const version = process.env.WHATSAPP_GRAPH_VERSION || 'v21.0'
  const url = `https://graph.facebook.com/${version}/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), WHATSAPP_TIMEOUT_MS)
  let res: Response
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: phone.replace(/^\+/, ''),
        type: 'template',
        template: {
          name: process.env.WHATSAPP_OTP_TEMPLATE,
          language: { code: WHATSAPP_LANGUAGE[lang] ?? 'en' },
          components: [
            { type: 'body', parameters: [{ type: 'text', text: code }] },
            { type: 'button', sub_type: 'url', index: '0', parameters: [{ type: 'text', text: code }] },
          ],
        },
      }),
      signal: controller.signal,
    })
  } catch (err) {
    throw new OtpDeliveryError('whatsapp', 'network', err instanceof Error ? err.message : String(err))
  } finally {
    clearTimeout(timer)
  }
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: { code?: number; message?: string } } | null
    throw new OtpDeliveryError('whatsapp', String(body?.error?.code ?? res.status), body?.error?.message ?? `HTTP ${res.status}`)
  }
}

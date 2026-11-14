import type { TranslationKey } from '@/lib/i18n/translations'
import type { OtpChannel } from './otp'

// Which channel a phone-change code travels on, decided from the number
// alone (pure and client-safe: the server enforces it, the website and the
// app use it to pick copy before and after a request).
//
// Israeli numbers (+972) get an SMS through the 019 gateway; every other
// country gets WhatsApp through the same gateway's approved templates.

const ISRAEL_CALLING_CODE = '972'

/**
 * Normalises a typed or stored number to its digits behind an implied "+":
 * leading whitespace, "+", "00" (the international dialling prefix) and the
 * separators people type ("-", ".", spaces, brackets) are dropped.
 */
export function normalizeOtpPhone(phone: string): string {
  const compact = phone.replace(/[\s\-(). ‎‏‪-‮⁦-⁩]/g, '')
  return compact.replace(/^\+/, '').replace(/^00/, '')
}

/** "+972…" and "972…" (any spacing or dashes) are SMS; every other number is WhatsApp. */
export function resolveOtpChannel(phone: string): OtpChannel {
  return normalizeOtpPhone(phone).startsWith(ISRAEL_CALLING_CODE) ? 'sms' : 'whatsapp'
}

/** The copy for a channel; each string holds a {phone} placeholder. */
export function otpCopyKeys(channel: OtpChannel): { pendingBody: TranslationKey; title: TranslationKey; subtitle: TranslationKey } {
  return channel === 'sms'
    ? { pendingBody: 'pending_phone_body_sms', title: 'otp_title_sms', subtitle: 'otp_subtitle_sms' }
    : { pendingBody: 'pending_phone_body_whatsapp', title: 'otp_title_whatsapp', subtitle: 'otp_subtitle_whatsapp' }
}

/** The text before and after a "{phone}" placeholder, so a screen can render the number in its own LTR element. */
export function splitAtPlaceholder(message: string, placeholder: string): [string, string] {
  const at = message.indexOf(placeholder)
  return at < 0 ? [message, ''] : [message.slice(0, at), message.slice(at + placeholder.length)]
}

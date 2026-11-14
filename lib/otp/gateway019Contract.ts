import type { Lang } from '@/lib/i18n/translations'

// Everything that depends on 019's actual API (019sms.co.il), in one place:
// the two endpoints, the auth header and the two request bodies. Fill these
// in from 019's documentation and nothing else changes (the adapter is
// lib/otp/gateway019.ts). Until both endpoints are set, the gateway reports
// itself unconfigured, so pasting credentials early can never send a
// half-formed request.

/** Absolute URL that sends one SMS. TODO(019 docs): empty until set. */
export const SMS_ENDPOINT = ''
/** Absolute URL that sends one WhatsApp template message. TODO(019 docs): empty until set. */
export const WHATSAPP_ENDPOINT = ''

// 019's WhatsApp template language for each of our languages (TODO(019 docs)).
const TEMPLATE_LANGUAGE: Record<Lang, string> = { en: 'en', he: 'he', ru: 'ru', fr: 'fr', es: 'es' }
// The pre-approved authentication template's name at 019 (TODO(019 docs)).
const OTP_TEMPLATE = 'landly_otp_code'

export interface Gateway019Credentials {
  username: string
  /** One of password / token is enough. */
  password?: string
  token?: string
  sender: string
}

/** How the request proves who we are (TODO(019 docs): Basic, Bearer, or fields in the body). */
export function authHeaders({ username, password, token }: Gateway019Credentials): Record<string, string> {
  if (token) return { Authorization: `Bearer ${token}` }
  return { Authorization: `Basic ${Buffer.from(`${username}:${password ?? ''}`).toString('base64')}` }
}

// The code comes first so it shows in the notification preview.
const SMS_TEXT: Record<Lang, (code: string) => string> = {
  en: (code) => `${code} is your GoLandly verification code.`,
  he: (code) => `${code} הוא קוד האימות שלך ב-GoLandly.`,
  ru: (code) => `${code} — ваш код подтверждения GoLandly.`,
  fr: (code) => `${code} est votre code de vérification GoLandly.`,
  es: (code) => `${code} es tu código de verificación de GoLandly.`,
}

/** The SMS request body (TODO(019 docs)). */
export function smsBody(creds: Gateway019Credentials, phone: string, code: string, lang: Lang): unknown {
  return { from: creds.sender, to: phone, message: SMS_TEXT[lang](code) }
}

/** The WhatsApp template request body (TODO(019 docs)). */
export function whatsappBody(creds: Gateway019Credentials, phone: string, code: string, lang: Lang): unknown {
  return { from: creds.sender, to: phone, template: { name: OTP_TEMPLATE, language: TEMPLATE_LANGUAGE[lang], parameters: [code] } }
}

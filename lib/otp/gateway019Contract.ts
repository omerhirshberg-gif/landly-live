// Everything that depends on 019's actual API (docs.019sms.co.il), in one
// place; the adapter is lib/otp/gateway019.ts. 019 generates the one-time
// code for both channels and returns it in the response: we hash it into
// phoneVerifications/{uid} and verify it ourselves, so 019's validate_otp is
// never called.
//
//   SMS       POST https://019sms.co.il/api                          root key `send_otp`
//   WhatsApp  POST https://019sms.co.il/whatsapp-api/send-otp-whatsapp  (019's own approved business line)
//
// The answer's `status` is what says whether it worked (HTTP 200 can carry
// status 4, "no credit"), so a send counts only on `status: 0` plus a code.
// The WhatsApp answer wraps that body in `data`.
//
// Every code message is English, whatever language the member uses the site
// in: one fixed SMS text and 019's English WhatsApp template (`language: '1'`).

const API_ORIGIN = 'https://019sms.co.il'

/** Sends one SMS code. (`${API_ORIGIN}/api/test` is the same call with nothing submitted.) */
export const SMS_ENDPOINT = `${API_ORIGIN}/api`
/** Sends one WhatsApp code. */
export const WHATSAPP_ENDPOINT = `${API_ORIGIN}/whatsapp-api/send-otp-whatsapp`

/** Groups our codes at 019 (1-1000); the value itself is arbitrary. */
const APP_ID = '1'
/** 019 allows 3-5 wrong attempts; we count our own, this is only its ceiling. */
const MAX_TRIES = '3'
/** Minutes 019 keeps a code (1-15). Ours expires after 10 (OTP_TTL_MS), so this never outlives it. */
const VALID_MINUTES = 10

export interface Gateway019Credentials {
  username: string
  token: string
  /** The verified alphanumeric sender shown on the SMS (at most 11 letters/digits). */
  sender: string
}

/** The token goes in the header on both channels (the SMS body also names the user). */
export function authHeaders({ token }: Pick<Gateway019Credentials, 'token'>): Record<string, string> {
  return { Authorization: `Bearer ${token}` }
}

/** Digits of an E.164 number: "+972501234567" -> "972501234567" (WhatsApp wants this, no "+"). */
export function internationalDigits(phone: string): string {
  return phone.replace(/\D/g, '')
}

/** SMS destinations are Israeli numbers in local form: "+972501234567" -> "0501234567". */
export function israeliLocalNumber(phone: string): string {
  const digits = internationalDigits(phone)
  return digits.startsWith('972') ? `0${digits.slice(3)}` : digits
}

// 019 swaps [code] for the code. It comes first so it shows in the notification preview.
export const SMS_TEXT = `[code] is your GoLandly verification code. Valid for ${VALID_MINUTES} minutes.`

/** The SMS request body. */
export function smsBody({ username, sender }: Gateway019Credentials, phone: string): unknown {
  return {
    send_otp: {
      user: { username },
      phone: israeliLocalNumber(phone),
      source: sender,
      app_id: APP_ID,
      max_tries: MAX_TRIES,
      valid_time: String(VALID_MINUTES),
      text: SMS_TEXT,
    },
  }
}

/** 019's code for its English WhatsApp template (2 is Hebrew; never sent). */
const WHATSAPP_ENGLISH = '1'

/** The WhatsApp request body: no sender (019 sends from its own line), always the English template. */
export function whatsappBody(phone: string): unknown {
  return { phone: internationalDigits(phone), app_id: APP_ID, max_tries: MAX_TRIES, language: WHATSAPP_ENGLISH }
}

export type FailureKind = 'auth' | 'rejected' | 'unavailable'

// 019's `status` values (docs.019sms.co.il/sms/errors-and-status.html).
const AUTH_STATUSES = new Set([3, 10, 11, 50, 511, 514]) // bad / expired / mismatched token, IP not allowed, no permission
const UNAVAILABLE_STATUSES = new Set([6, 429, 502, 997, 998, 999]) // process failure, rate limit, unknown: worth a retry

/** How a non-zero 019 status is reported: auth (our setup), unavailable (try again), rejected (this number or request, or no credit). */
export function classifyStatus(status: number): FailureKind {
  if (AUTH_STATUSES.has(status)) return 'auth'
  if (UNAVAILABLE_STATUSES.has(status)) return 'unavailable'
  return 'rejected'
}

/** `reason` is 019's own word for a failure without a numeric status (WhatsApp: `notEnoughCredits`), only when it is a plain word. */
export type Gateway019Answer = { ok: true; code: string } | { ok: false; kind: FailureKind; status: number | null; reason?: string }

/**
 * Reads 019's answer body. Never includes the body in what it returns: the
 * code is the only part kept, and only on success.
 */
export function parseAnswer(raw: string, channel: 'sms' | 'whatsapp'): Gateway019Answer {
  let json: unknown
  try {
    json = JSON.parse(raw)
  } catch {
    return { ok: false, kind: 'unavailable', status: null }
  }
  const root = json && typeof json === 'object' ? (json as Record<string, unknown>) : {}
  const nested = root.data
  const body = channel === 'whatsapp' && nested && typeof nested === 'object' ? (nested as Record<string, unknown>) : root
  // WhatsApp refuses some sends without a status: {"data":{"success":false,"message":"notEnoughCredits"}}.
  if (body.success === false) {
    const reason = typeof body.message === 'string' && /^[A-Za-z]{1,40}$/.test(body.message) ? body.message : undefined
    return { ok: false, kind: reason && /credit/i.test(reason) ? 'rejected' : 'unavailable', status: null, reason }
  }
  const status = Number(body.status)
  if (!Number.isInteger(status)) return { ok: false, kind: 'unavailable', status: null }
  if (status !== 0) return { ok: false, kind: classifyStatus(status), status }
  // Accepted, but a send we cannot verify later is no send.
  const code = typeof body.code === 'string' || typeof body.code === 'number' ? String(body.code) : ''
  return /^\d{6}$/.test(code) ? { ok: true, code } : { ok: false, kind: 'unavailable', status }
}

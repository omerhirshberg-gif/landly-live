import 'server-only'
import type { OtpChannel } from '@/lib/auth/otp'
import { authHeaders, parseAnswer, SMS_ENDPOINT, smsBody, WHATSAPP_ENDPOINT, whatsappBody, type Gateway019Credentials } from './gateway019Contract'

// The 019 delivery gateway (019sms.co.il) for phone-change codes. 019
// generates the 6-digit code and returns it; we hash it, rate-limit it and
// verify it ourselves (lib/auth/phoneVerification.ts,
// phoneVerifications/{uid}). An Israeli number gets an SMS, any other number
// a WhatsApp message from 019's own approved business line (no Meta Business
// Verification of our own). The support bot's Meta Cloud API (lib/whatsapp/*)
// is separate.
//
// Everything that depends on 019's actual API (endpoints, auth header,
// request bodies, status codes) is in ./gateway019Contract.ts. Until the
// username, token and sender are set, gateway019ConfigProblem() reports it:
// the app keeps simulating (dev) or saving the number directly (production).
//
// Messages are always English, whatever language the member browses in (see
// the contract), so the adapter takes no language.
//
// Credentials and the returned code are read here only. Neither reaches a log
// line, an error message or a client response: failures are reported as a
// status class and 019's numeric status.

const TIMEOUT_MS = 10_000


/** The channel's delivery failed. `code` is a credential-free class: not_configured, network, auth, rejected, unavailable. */
export class Gateway019Error extends Error {
  constructor(
    readonly code: 'not_configured' | 'network' | 'auth' | 'rejected' | 'unavailable',
    message: string
  ) {
    super(message)
    this.name = 'Gateway019Error'
  }
}

export function gateway019Credentials(): Gateway019Credentials | null {
  const username = process.env.SMS_019_USERNAME?.trim()
  const token = process.env.SMS_019_TOKEN?.trim()
  const sender = process.env.SMS_019_SENDER?.trim()
  if (!username || !token || !sender) return null
  return { username, token, sender }
}

/** Names the first missing setting, or null when sending through 019 is configured. */
export function gateway019ConfigProblem(): string | null {
  if (!process.env.SMS_019_USERNAME?.trim()) return 'SMS_019_USERNAME is not configured'
  if (!process.env.SMS_019_TOKEN?.trim()) return 'SMS_019_TOKEN is not configured'
  if (!process.env.SMS_019_SENDER?.trim()) return 'SMS_019_SENDER is not configured'
  return null
}

/**
 * Real messages leave in production; elsewhere only with OTP_019_LIVE=true
 * (to try the real thing from a laptop), and never without a complete
 * configuration. Otherwise callers simulate by logging.
 */
export function gateway019Live(): boolean {
  const live = process.env.NODE_ENV === 'production' || process.env.OTP_019_LIVE === 'true'
  return live && !gateway019ConfigProblem()
}

/** Posts one request and returns the code 019 issued; throws a credential-free Gateway019Error otherwise. */
async function post(channel: OtpChannel, url: string, creds: Gateway019Credentials, body: unknown): Promise<{ code: string }> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  let res: Response
  let text: string
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders(creds) },
      body: JSON.stringify(body),
      signal: controller.signal,
    })
    text = await res.text()
  } catch {
    // Timeout, DNS, reset: the cause may quote the URL or headers, so none of it is kept.
    throw new Gateway019Error('network', `019 ${channel} gateway unreachable`)
  } finally {
    clearTimeout(timer)
  }
  if (res.status === 401 || res.status === 403) throw new Gateway019Error('auth', `019 ${channel} gateway answered HTTP ${res.status}`)
  if (res.status >= 500) throw new Gateway019Error('unavailable', `019 ${channel} gateway answered HTTP ${res.status}`)
  // HTTP 200 does not mean sent: 019 puts the outcome in the body's `status`.
  const answer = parseAnswer(text, channel)
  if (answer.ok) return { code: answer.code }
  const reason = answer.status !== null ? `status ${answer.status}` : answer.reason ? `"${answer.reason}"` : `HTTP ${res.status}, unreadable answer`
  throw new Gateway019Error(res.ok ? answer.kind : answer.kind === 'auth' ? 'auth' : 'rejected', `019 ${channel} gateway answered ${reason}`)
}

function configured(): Gateway019Credentials {
  const creds = gateway019Credentials()
  if (!creds || gateway019ConfigProblem()) throw new Gateway019Error('not_configured', gateway019ConfigProblem() ?? '019 is not configured')
  return creds
}

/** Sends an English SMS code to an Israeli number; resolves with the code 019 generated. */
export async function sendVia019Sms({ phone }: { phone: string }): Promise<{ code: string }> {
  const creds = configured()
  return post('sms', SMS_ENDPOINT, creds, smsBody(creds, phone))
}

/** Sends an English WhatsApp code to an international number; resolves with the code 019 generated. */
export async function sendVia019WhatsApp({ phone }: { phone: string }): Promise<{ code: string }> {
  const creds = configured()
  return post('whatsapp', WHATSAPP_ENDPOINT, creds, whatsappBody(phone))
}

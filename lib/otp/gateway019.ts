import 'server-only'
import type { Lang } from '@/lib/i18n/translations'
import type { OtpChannel } from '@/lib/auth/otp'
import { authHeaders, SMS_ENDPOINT, smsBody, WHATSAPP_ENDPOINT, whatsappBody, type Gateway019Credentials } from './gateway019Contract'

// The 019 delivery gateway (019sms.co.il) for phone-change codes. 019 only
// delivers: the code is generated, hashed, rate-limited and verified by us
// (lib/auth/phoneVerification.ts, phoneVerifications/{uid}). An Israeli
// number gets an SMS, any other number a WhatsApp message built on one of
// 019's pre-approved Meta templates (no Meta Business Verification of our
// own). The support bot's Meta Cloud API (lib/whatsapp/*) is separate.
//
// Everything that depends on 019's actual API (endpoints, auth header,
// request bodies) is in ./gateway019Contract.ts. Until its endpoints are set,
// gateway019ConfigProblem() reports it, so pasting credentials early can
// never send a half-formed request: the app keeps simulating (dev) or saving
// the number directly (production).
//
// Credentials are read here only. They never reach a log line, an error
// message or a response: failures are reported as a status class.

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
  const password = process.env.SMS_019_PASSWORD?.trim()
  const token = process.env.SMS_019_TOKEN?.trim()
  const sender = process.env.SMS_019_SENDER?.trim()
  if (!username || !sender || (!password && !token)) return null
  return { username, password: password || undefined, token: token || undefined, sender }
}

/** Names the first missing setting, or null when sending through 019 is configured. */
export function gateway019ConfigProblem(): string | null {
  if (!process.env.SMS_019_USERNAME?.trim()) return 'SMS_019_USERNAME is not configured'
  if (!process.env.SMS_019_PASSWORD?.trim() && !process.env.SMS_019_TOKEN?.trim()) return 'SMS_019_PASSWORD or SMS_019_TOKEN is not configured'
  if (!process.env.SMS_019_SENDER?.trim()) return 'SMS_019_SENDER is not configured'
  if (!SMS_ENDPOINT || !WHATSAPP_ENDPOINT) return 'the 019 endpoints are not set in lib/otp/gateway019.ts'
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

async function post(channel: OtpChannel, url: string, creds: Gateway019Credentials, body: unknown): Promise<void> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  let res: Response
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders(creds) },
      body: JSON.stringify(body),
      signal: controller.signal,
    })
  } catch {
    // Timeout, DNS, reset: the cause may quote the URL or headers, so none of it is kept.
    throw new Gateway019Error('network', `019 ${channel} gateway unreachable`)
  } finally {
    clearTimeout(timer)
  }
  if (res.ok) return
  const code = res.status === 401 || res.status === 403 ? 'auth' : res.status >= 500 ? 'unavailable' : 'rejected'
  throw new Gateway019Error(code, `019 ${channel} gateway answered HTTP ${res.status}`)
}

function configured(): Gateway019Credentials {
  const creds = gateway019Credentials()
  if (!creds || gateway019ConfigProblem()) throw new Gateway019Error('not_configured', gateway019ConfigProblem() ?? '019 is not configured')
  return creds
}

export async function sendVia019Sms({ phone, code, lang }: { phone: string; code: string; lang: Lang }): Promise<void> {
  const creds = configured()
  await post('sms', SMS_ENDPOINT, creds, smsBody(creds, phone, code, lang))
}

export async function sendVia019WhatsApp({ phone, code, lang }: { phone: string; code: string; lang: Lang }): Promise<void> {
  const creds = configured()
  await post('whatsapp', WHATSAPP_ENDPOINT, creds, whatsappBody(creds, phone, code, lang))
}

import { signInWithCustomToken, type Auth, type User } from 'firebase/auth'
import { normalizeApiBaseUrl } from '@/lib/apiOrigin'
import type { Lang } from '@/lib/i18n/translations'
import type { OtpChannel } from '@/lib/auth/otp'

/**
 * Why an email or phone change step didn't go through; the profile screens
 * map each one to copy (contactChangeErrorKey).
 *
 * reauthRequired -- the email change needs the current password again
 * delivery       -- the code couldn't be sent (WhatsApp/SMS provider refused)
 * invalid        -- an unknown kind of pending change to cancel
 * unauthorized   -- the session expired or was revoked
 * failed         -- the server answered but couldn't finish, or the base redirects
 * offline        -- no answer: no connection, CORS block or the 15s timeout
 */
export type ContactChangeReason =
  | 'rateLimited'
  | 'unauthorized'
  | 'reauthRequired'
  | 'notPasswordAccount'
  | 'invalidEmail'
  | 'sameEmail'
  | 'emailInUse'
  | 'invalidPhone'
  | 'samePhone'
  | 'delivery'
  | 'noPending'
  | 'invalidCode'
  | 'expired'
  | 'tooManyAttempts'
  | 'invalid'
  | 'failed'
  | 'offline'

export type ContactChangeFailure = { ok: false; reason: ContactChangeReason; attemptsLeft?: number; retryAfter?: number }
export type ContactChangeResult<T extends object = object> = ({ ok: true } & T) | ContactChangeFailure

export const CONTACT_CHANGE_TIMEOUT_MS = 15_000

/** For a step that threw before reaching the server (e.g. getIdToken). */
export const CONTACT_CHANGE_FAILED: ContactChangeFailure = { ok: false, reason: 'failed' }

const KNOWN_REASONS = new Set<string>([
  'rateLimited', 'unauthorized', 'reauthRequired', 'notPasswordAccount', 'invalidEmail', 'sameEmail', 'emailInUse',
  'invalidPhone', 'samePhone', 'delivery', 'noPending', 'invalidCode', 'expired', 'tooManyAttempts', 'invalid',
])

// Client-side caller for the /api/account email and phone change routes,
// shared by the website (same origin, base '') and the app (passes
// API_BASE_URL). Same transport rules as lib/account/revokeSessions.ts: a
// redirect is 'failed' (one to another host would drop the Authorization
// header), and the timeout uses setTimeout + AbortController for Hermes.
async function post<T extends object>(path: string, idToken: string | null, payload: object, apiBaseUrl: string): Promise<ContactChangeResult<T>> {
  const base = normalizeApiBaseUrl(apiBaseUrl)
  const url = `${base}${path}`
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), CONTACT_CHANGE_TIMEOUT_MS)
  let res: Response
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}) },
      body: JSON.stringify(payload),
      redirect: 'manual',
      signal: controller.signal,
    })
  } catch {
    return { ok: false, reason: 'offline' }
  } finally {
    clearTimeout(timer)
  }
  const redirected = res.type === 'opaqueredirect' || (res.status >= 300 && res.status < 400) || (!!base && !!res.url && res.url !== url)
  if (redirected) return { ok: false, reason: 'failed' }
  const body = (await res.json().catch(() => null)) as Record<string, unknown> | null
  if (res.ok && body?.ok === true) return body as { ok: true } & T
  const reason = typeof body?.reason === 'string' && KNOWN_REASONS.has(body.reason)
    ? (body.reason as ContactChangeReason)
    : res.status === 429 ? 'rateLimited' : res.status === 401 ? 'unauthorized' : 'failed'
  return {
    ok: false,
    reason,
    ...(typeof body?.attemptsLeft === 'number' ? { attemptsLeft: body.attemptsLeft } : {}),
    ...(typeof body?.retryAfter === 'number' ? { retryAfter: body.retryAfter } : {}),
  }
}

export type EmailChangeStart = { pendingEmail: string; resendIn: number }

/** Sends a 6-digit code to `newEmail`; call right after re-entering the password. */
export function requestEmailChange(idToken: string, params: { newEmail: string; lang: Lang }, apiBaseUrl = '') {
  return post<EmailChangeStart>('/api/account/change-email', idToken, params, apiBaseUrl)
}

/** A fresh code to the address already pending. */
export function resendEmailChange(idToken: string, lang: Lang, apiBaseUrl = '') {
  return post<EmailChangeStart>('/api/account/change-email', idToken, { resend: true, lang }, apiBaseUrl)
}

/**
 * Applies the pending email change once its code matches. The server then
 * ends every session; `customToken` is this device's way back in.
 */
export function verifyEmailCode(idToken: string, code: string, apiBaseUrl = '') {
  return post<{ email: string; customToken?: string }>('/api/account/verify-email-otp', idToken, { code }, apiBaseUrl)
}

/**
 * Run by the verification dialog/sheet after a verified email change: signs
 * this device back in with the custom token (its old session was just
 * revoked), or without one only reloads the Auth record so it shows the new
 * address. Same uid either way, so the screens stay as they are.
 */
export async function finishEmailChange(auth: Auth, user: User, customToken: string | undefined): Promise<void> {
  if (customToken) await signInWithCustomToken(auth, customToken)
  else await user.reload()
}

export type PhoneChangeStart = { mode: 'direct' } | { mode: 'otp'; channel: OtpChannel; resendIn: number }

/** Starts (or resends the code for) a phone change; 'direct' means save the number as before. */
export function requestPhoneChange(idToken: string, params: { phone: string; lang: Lang; channel?: OtpChannel }, apiBaseUrl = '') {
  return post<PhoneChangeStart>('/api/account/change-phone', idToken, params, apiBaseUrl)
}

export function verifyPhoneCode(idToken: string, code: string, apiBaseUrl = '') {
  return post<{ phone: string }>('/api/account/verify-phone-otp', idToken, { code }, apiBaseUrl)
}

export function cancelPendingChange(idToken: string, kind: 'email' | 'phone', apiBaseUrl = '') {
  return post('/api/account/cancel-pending', idToken, { kind }, apiBaseUrl)
}

/**
 * The translation key for a failed step (both platforms use the same copy).
 * An expired or used-up code tells the member to change the same thing again,
 * so those two name the email for an email change.
 */
export function contactChangeErrorKey(reason: ContactChangeReason, kind: 'email' | 'phone' = 'phone') {
  if (kind === 'email' && reason === 'expired') return 'contact_err_expired_email'
  if (kind === 'email' && reason === 'tooManyAttempts') return 'contact_err_tooManyAttempts_email'
  switch (reason) {
    case 'rateLimited': return 'contact_err_rateLimited'
    case 'unauthorized': return 'contact_err_session'
    case 'reauthRequired': return 'contact_err_reauth'
    case 'invalidEmail': return 'contact_err_invalidEmail'
    case 'sameEmail': return 'contact_err_sameEmail'
    case 'emailInUse': return 'contact_err_emailInUse'
    case 'invalidPhone': return 'phone_invalid_error'
    case 'samePhone': return 'contact_err_samePhone'
    case 'delivery': return 'contact_err_delivery'
    case 'invalidCode': return 'contact_err_invalidCode'
    case 'expired': return 'contact_err_expired'
    case 'tooManyAttempts': return 'contact_err_tooManyAttempts'
    case 'noPending': return 'contact_err_noPending'
    case 'offline': return 'contact_err_offline'
    default: return 'contact_err_generic'
  }
}

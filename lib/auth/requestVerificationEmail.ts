import { normalizeApiBaseUrl, PRODUCTION_API_ORIGIN } from '@/lib/apiOrigin'
import type { Lang } from '@/lib/i18n/translations'

/**
 * sent          -- the email is on its way
 * rateLimited   -- too many requests; try again in a minute
 * unauthorized  -- the ID token is missing, invalid or expired (an hour after capture)
 * failed        -- the server answered but couldn't send
 * offline       -- no answer: no connection, CORS block or the 15s timeout
 * misconfigured -- the API base URL redirects, which would drop the token
 */
export type VerificationSendResult = 'sent' | 'rateLimited' | 'unauthorized' | 'failed' | 'offline' | 'misconfigured'

// The route makes several Admin SDK calls and a Resend call; past this the
// request is abandoned and reported as 'failed', so a stalled server or
// network never leaves a spinner up. (setTimeout + AbortController rather
// than AbortSignal.timeout, which Hermes doesn't reliably provide.)
export const VERIFICATION_SEND_TIMEOUT_MS = 15_000

const PATH = '/api/auth/send-verification'

// Client-side caller for /api/auth/send-verification. Takes a raw ID token
// rather than a User because callers sign the unverified user out right
// away (so the rest of the app never treats them as logged in) and keep
// only the token around for the "resend" button. The web app calls its own
// origin; the mobile app passes the deployed site as `apiBaseUrl`.
//
// That base must be the final host: a redirect to another origin (e.g.
// golandly.com -> www.golandly.com) makes every HTTP stack drop the
// Authorization header, and the server would only ever see a 401. So an apex
// golandly.com base is rewritten to www up front (normalizeApiBaseUrl), and
// redirects aren't followed (browsers honour redirect: 'manual'; React
// Native's fetch ignores it, hence the response-URL check too). If a remote
// base still redirects, the request is retried once, token included, straight
// at the production host; only if that redirects as well is it 'misconfigured'.
//
// `names` is sent only with the first request after sign-up: the route
// stores them on the new profile (the unverified client can't write it),
// along with the Terms/Privacy consent given on the sign-up form.
export interface SignUpNames {
  firstName: string
  lastName: string
  /** The sign-up form's Terms of Service / Privacy Policy checkbox. */
  agreedToTerms?: boolean
}

export async function requestVerificationEmail(
  idToken: string,
  lang: Lang,
  apiBaseUrl = '',
  names?: SignUpNames
): Promise<VerificationSendResult> {
  const base = normalizeApiBaseUrl(apiBaseUrl)
  const body = JSON.stringify(
    names ? { lang, firstName: names.firstName, lastName: names.lastName, agreedToTerms: names.agreedToTerms === true } : { lang }
  )
  const first = await post(`${base}${PATH}`, idToken, body, !!base)
  if (first !== 'redirected') return first
  // Same-origin web calls never fall back to production: a redirect there is
  // the site's own setup, not a stale app config.
  if (base && base !== PRODUCTION_API_ORIGIN) {
    console.warn(`[verification] ${base}${PATH} redirects; retrying at ${PRODUCTION_API_ORIGIN}. Point the API base URL at the final host.`)
    const retry = await post(`${PRODUCTION_API_ORIGIN}${PATH}`, idToken, body, true)
    if (retry !== 'redirected') return retry
  }
  // console.warn, not error: React Native turns console.error into a redbox.
  console.warn(`[verification] ${base}${PATH} redirects; point the API base URL at the final host.`)
  return 'misconfigured'
}

// Development builds report every unsuccessful send -- URL, HTTP status and
// the server's response body -- so the cause shows in the Metro terminal
// (Expo Go) or the browser console (web) instead of only as a generic notice.
// Production builds stay quiet. Never logs the token or headers. console.warn,
// not error: React Native turns console.error into a redbox.
const DEV = process.env.NODE_ENV !== 'production'
const BODY_LIMIT = 2000

async function readBody(res: Response): Promise<unknown> {
  try {
    const text = (await res.text()).slice(0, BODY_LIMIT)
    try {
      return JSON.parse(text)
    } catch {
      return text
    }
  } catch {
    return '(unreadable body)'
  }
}

async function post(url: string, idToken: string, body: string, absolute: boolean): Promise<VerificationSendResult | 'redirected'> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), VERIFICATION_SEND_TIMEOUT_MS)
  let res: Response
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
      body,
      redirect: 'manual',
      signal: controller.signal,
    })
  } catch (err) {
    if (DEV) {
      const e = err as { name?: string; message?: string }
      const timedOut = e?.name === 'AbortError'
      console.warn(
        `[verification] POST ${url} -> no response (${timedOut ? `timed out after ${VERIFICATION_SEND_TIMEOUT_MS / 1000}s` : 'network error'}): offline`,
        `${e?.name ?? 'Error'}: ${e?.message ?? String(err)}`
      )
    }
    return 'offline'
  } finally {
    clearTimeout(timer)
  }
  const redirected =
    res.type === 'opaqueredirect' || (res.status >= 300 && res.status < 400) || (absolute && !!res.url && res.url !== url)
  const result: VerificationSendResult | 'redirected' = redirected
    ? 'redirected'
    : res.ok
      ? 'sent'
      : res.status === 429
        ? 'rateLimited'
        : res.status === 401
          ? 'unauthorized'
          : 'failed'
  if (DEV && result !== 'sent') {
    const landed = res.url && res.url !== url ? ` (landed on ${res.url})` : ''
    const body = res.type === 'opaqueredirect' ? '(opaque redirect, no body)' : await readBody(res)
    console.warn(`[verification] POST ${url} -> ${res.status} ${result}${landed}`, body)
  }
  return result
}

import { normalizeApiBaseUrl } from '@/lib/apiOrigin'
import type { AppleRevocation } from './appleRevocation'
import type { DeletionReason } from './deletionReasons'

/**
 * sent         -- the team has the request (a repeat within 24 hours counts too)
 * rateLimited  -- too many tries; wait a few minutes
 * unauthorized -- the session expired; sign in again
 * failed       -- the server answered but couldn't send it, or the base redirects
 * offline      -- no answer: no connection, CORS block or the 15s timeout
 */
export type DeletionRequestResult = 'sent' | 'rateLimited' | 'unauthorized' | 'failed' | 'offline'

export const DELETION_REQUEST_TIMEOUT_MS = 15_000
const PATH = '/api/account/delete-request'

export interface DeletionRequestInput {
  reason: DeletionReason | null
  details: string
  lang: string
  /** Apple accounts only: what happened to their Sign in with Apple tokens (appleRevocation.ts). */
  appleRevocation?: AppleRevocation
}

// Client-side caller for /api/account/delete-request, shared by the website
// (same origin, base '') and the app (passes API_BASE_URL). Who is asking
// comes from the ID token on the server, never from this body. Redirects
// aren't followed: one to another host would drop the Authorization header,
// so it's reported as 'failed' (React Native's fetch ignores redirect:
// 'manual', hence the response-URL check). setTimeout + AbortController
// rather than AbortSignal.timeout, which Hermes doesn't reliably provide.
export async function requestAccountDeletion(
  idToken: string,
  input: DeletionRequestInput,
  apiBaseUrl = ''
): Promise<DeletionRequestResult> {
  const base = normalizeApiBaseUrl(apiBaseUrl)
  const url = `${base}${PATH}`
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), DELETION_REQUEST_TIMEOUT_MS)
  let res: Response
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
      body: JSON.stringify({ confirm: true, reason: input.reason, details: input.details, lang: input.lang, appleRevocation: input.appleRevocation }),
      redirect: 'manual',
      signal: controller.signal,
    })
  } catch {
    return 'offline'
  } finally {
    clearTimeout(timer)
  }
  const redirected = res.type === 'opaqueredirect' || (res.status >= 300 && res.status < 400) || (!!base && !!res.url && res.url !== url)
  if (redirected) return 'failed'
  if (res.ok) return 'sent'
  if (res.status === 429) return 'rateLimited'
  if (res.status === 401) return 'unauthorized'
  return 'failed'
}

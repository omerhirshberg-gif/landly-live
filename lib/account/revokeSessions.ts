import { normalizeApiBaseUrl } from '@/lib/apiOrigin'

/**
 * done         -- every session is revoked; sign this device out too
 * rateLimited  -- too many tries; wait a minute
 * unauthorized -- the session already expired or was revoked; sign in again
 * failed       -- the server answered but couldn't revoke, or the base redirects
 * offline      -- no answer: no connection, CORS block or the 15s timeout
 */
export type RevokeSessionsResult = 'done' | 'rateLimited' | 'unauthorized' | 'failed' | 'offline'

export const REVOKE_SESSIONS_TIMEOUT_MS = 15_000
const PATH = '/api/account/revoke-sessions'

// Client-side caller for /api/account/revoke-sessions, shared by the website
// (same origin, base '') and the app (passes API_BASE_URL). Same transport
// rules as requestAccountDeletion: redirects are reported as 'failed' (one to
// another host would drop the Authorization header), and the timeout uses
// setTimeout + AbortController for Hermes.
export async function revokeAllSessions(idToken: string, apiBaseUrl = ''): Promise<RevokeSessionsResult> {
  const base = normalizeApiBaseUrl(apiBaseUrl)
  const url = `${base}${PATH}`
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), REVOKE_SESSIONS_TIMEOUT_MS)
  let res: Response
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${idToken}` },
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
  if (res.ok) return 'done'
  if (res.status === 429) return 'rateLimited'
  if (res.status === 401) return 'unauthorized'
  return 'failed'
}

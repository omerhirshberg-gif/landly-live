import { normalizeApiBaseUrl } from '@/lib/apiOrigin'

export const SESSION_SYNC_TIMEOUT_MS = 15_000

// Client-side callers that tell the server a password just changed, so it
// copies Firebase's revocation of the member's other sessions into Firestore
// (lib/auth/sessionRevocation.ts syncSessionCutoff). Shared by the website
// (same origin, base '') and the app (passes API_BASE_URL); same transport
// rules as revokeSessions.ts (no redirects followed, setTimeout +
// AbortController for Hermes). Best effort: the password change itself has
// already succeeded, so a failure is only reported, never shown.
async function post(path: string, init: { idToken?: string; body?: object }, apiBaseUrl: string): Promise<boolean> {
  const base = normalizeApiBaseUrl(apiBaseUrl)
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), SESSION_SYNC_TIMEOUT_MS)
  try {
    const res = await fetch(`${base}${path}`, {
      method: 'POST',
      headers: {
        ...(init.body ? { 'Content-Type': 'application/json' } : {}),
        ...(init.idToken ? { Authorization: `Bearer ${init.idToken}` } : {}),
      },
      ...(init.body ? { body: JSON.stringify(init.body) } : {}),
      redirect: 'manual',
      signal: controller.signal,
    })
    return res.ok
  } catch {
    return false
  } finally {
    clearTimeout(timer)
  }
}

/** After updatePassword, with the session's fresh ID token. */
export function syncSessionsAfterPasswordChange(idToken: string, apiBaseUrl = ''): Promise<boolean> {
  return post('/api/account/sync-sessions', { idToken }, apiBaseUrl)
}

/** After confirmPasswordReset, with the address verifyPasswordResetCode returned (no session yet). */
export function reportPasswordReset(email: string, apiBaseUrl = ''): Promise<boolean> {
  return post('/api/auth/password-reset-complete', { body: { email } }, apiBaseUrl)
}

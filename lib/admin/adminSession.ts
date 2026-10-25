// Client-side counterpart to lib/admin/sessionToken.ts. The session itself
// is an httpOnly cookie set at login, which page scripts never see and every
// same-origin admin call carries on its own; this module only tracks whether
// AdminGate has confirmed it (GET /api/admin/session) and ends it on logout.

// Where sessions were kept before the cookie (one tab, cleared with it); removed on sight.
const LEGACY_SESSION_KEY = 'landly_admin_session'

let signedIn = false

/** Whether this page has a confirmed session: AdminGate checked it, and no call has since come back 401. */
export const isSignedIn = () => signedIn

export function markSignedIn(): void {
  signedIn = true
}

function forgetLegacyToken(): void {
  try {
    sessionStorage.removeItem(LEGACY_SESSION_KEY)
  } catch {}
}

/** Asks the server whether the session cookie is still good (it can't be read from here). */
export async function checkAdminSession(): Promise<boolean> {
  forgetLegacyToken()
  try {
    const res = await fetch('/api/admin/session', { cache: 'no-store' })
    signedIn = res.ok
  } catch {
    signedIn = false
  }
  return signedIn
}

/** Ends the session: the server clears the cookie. */
export async function logoutAdmin(): Promise<void> {
  signedIn = false
  forgetLegacyToken()
  await fetch('/api/admin/session', { method: 'DELETE' }).catch(() => {})
}

/** After a 401 (expired, tampered, or missing session): back to login. A hard navigation, so this works from any call site. */
export function sendToLogin(): void {
  signedIn = false
  window.location.href = '/admin/login'
}

// Shared by every admin page: the session cookie goes along on its own; a
// 401 sends the user back to login.
export async function adminFetch(url: string, init: RequestInit = {}): Promise<Response> {
  const res = await fetch(url, { credentials: 'same-origin', ...init })
  if (res.status === 401) sendToLogin()
  return res
}

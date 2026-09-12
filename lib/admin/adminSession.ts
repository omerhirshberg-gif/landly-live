// Client-side counterpart to lib/admin/sessionToken.ts. Stores the signed
// session token (never the raw admin password) and attaches it to every
// admin API call.
export const ADMIN_SESSION_KEY = 'landly_admin_session'

export function getStoredToken(): string | null {
  return sessionStorage.getItem(ADMIN_SESSION_KEY)
}

export function setStoredToken(token: string): void {
  sessionStorage.setItem(ADMIN_SESSION_KEY, token)
}

export function clearStoredToken(): void {
  sessionStorage.removeItem(ADMIN_SESSION_KEY)
}

function base64UrlDecode(input: string): string {
  let base64 = input.replace(/-/g, '+').replace(/_/g, '/')
  while (base64.length % 4 !== 0) base64 += '='
  return atob(base64)
}

// Client-side sanity check only -- it can't verify the token's signature
// (it doesn't have ADMIN_SESSION_SECRET, and never should), so this just
// lets AdminGate redirect early on an obviously-expired token instead of
// waiting for the first API call to 401. lib/admin/sessionToken.ts's
// verifyAdminSessionToken, run server-side on every real request, is the
// actual security boundary.
export function isTokenExpired(token: string): boolean {
  try {
    const [payloadB64] = token.split('.')
    const payload = JSON.parse(base64UrlDecode(payloadB64))
    return typeof payload.exp !== 'number' || payload.exp <= Date.now()
  } catch {
    return true
  }
}

// Shared by every admin page: attaches the session token and, on a 401
// (expired, tampered, or missing), clears it and sends the user back to
// login -- the backstop for whatever isTokenExpired's client-side check
// above missed. A hard navigation (not router.replace) so this plain
// function works from any call site without needing useRouter threaded in.
export async function adminFetch(url: string, init: RequestInit = {}): Promise<Response> {
  const token = getStoredToken()
  const headers = new Headers(init.headers)
  headers.set('Authorization', `Bearer ${token ?? ''}`)

  const res = await fetch(url, { ...init, headers })
  if (res.status === 401) {
    clearStoredToken()
    window.location.href = '/admin/login'
  }
  return res
}

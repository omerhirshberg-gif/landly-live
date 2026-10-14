// CORS for the few API routes the mobile app calls from a browser (the Expo
// web build): the Next.js site calls them same-origin and native apps aren't
// subject to CORS. These routes authorize with a Bearer ID token, never
// cookies, so letting another origin call them grants nothing without a
// valid token. Allowed: loopback origins on any port (Expo web in local
// development) and the comma-separated CORS_ALLOWED_ORIGINS (deployed Expo
// web builds, e.g. "https://app.golandly.com").

const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]'])

export function isAllowedOrigin(origin: string | null): origin is string {
  if (!origin) return false
  let url: URL
  try {
    url = new URL(origin)
  } catch {
    return false
  }
  if ((url.protocol === 'http:' || url.protocol === 'https:') && LOOPBACK_HOSTS.has(url.hostname)) return true
  const configured = (process.env.CORS_ALLOWED_ORIGINS ?? '')
    .split(',')
    .map((o) => o.trim().replace(/\/+$/, ''))
    .filter(Boolean)
  return configured.includes(url.origin)
}

/** Headers to add to every response (preflight included) for an allowed Origin; none otherwise. */
export function corsHeaders(request: Request, methods = 'POST, OPTIONS'): Record<string, string> {
  const origin = request.headers.get('origin')
  if (!isAllowedOrigin(origin)) return { Vary: 'Origin' }
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': methods,
    'Access-Control-Allow-Headers': 'Authorization, Content-Type',
    'Access-Control-Max-Age': '600',
    Vary: 'Origin',
  }
}

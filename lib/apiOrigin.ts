// Where the mobile app reaches the Next.js API. It must be the final host:
// golandly.com answers with a redirect to www.golandly.com, and every HTTP
// stack drops the Authorization header on a cross-origin redirect, so a call
// to the apex domain arrives unauthenticated. (landly-mobile/app.config.js
// repeats this value as its default; it can't import TypeScript.)
export const PRODUCTION_API_ORIGIN = 'https://www.golandly.com'

// The apex domain, over http or https, with or without a port or path.
const APEX = /^(?:https?:)?\/\/golandly\.com(?=[:/?#]|$)(?::\d+)?/i

/**
 * Rewrites an apex golandly.com base (e.g. from a stale app manifest or an
 * old EXPO_PUBLIC_API_BASE_URL) to the final https://www.golandly.com host and
 * drops trailing slashes. Anything else -- '' for same-origin calls, a LAN or
 * tunnel URL -- is returned as is. A regex rather than URL: React Native's URL
 * implementation doesn't support editing a host.
 */
export function normalizeApiBaseUrl(base: string): string {
  return base.trim().replace(APEX, PRODUCTION_API_ORIGIN).replace(/\/+$/, '')
}

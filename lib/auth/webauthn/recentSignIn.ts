// Adding a passkey needs a sign-in from the last 10 minutes (the ID token's
// auth_time, in seconds), so a session someone else got hold of can't add a
// passkey of its own and keep access after the session is revoked. The
// website asks for the password (or Google) again when this says no.
export const RECENT_SIGN_IN_MS = 10 * 60 * 1000

export function isRecentSignIn(authTimeSeconds: unknown, now = Date.now()): boolean {
  if (typeof authTimeSeconds !== 'number' || !Number.isFinite(authTimeSeconds)) return false
  const age = now - authTimeSeconds * 1000
  return age >= -60_000 && age <= RECENT_SIGN_IN_MS
}

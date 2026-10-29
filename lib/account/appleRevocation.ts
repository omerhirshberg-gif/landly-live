import type { UserCredential } from 'firebase/auth'

// Revoking Landly's Sign in with Apple tokens when a member asks for their
// account to be deleted (App Store Review Guideline 5.1.1(v)). Apple's tokens
// are never stored, so the member confirms with Apple once more on the
// deletion form; the fresh credential is revoked, then the request goes to
// the team with the outcome. Revocation never blocks the request: only
// backing out of Apple's confirmation (or confirming with another Apple ID)
// stops it. No platform imports, so the website, the app and its browser
// build share it; each passes in its own Firebase calls.

/** What the team is told about the member's Apple tokens. */
export const APPLE_REVOCATIONS = ['revoked', 'failed', 'unavailable'] as const
export type AppleRevocation = (typeof APPLE_REVOCATIONS)[number]

export function isAppleRevocation(value: unknown): value is AppleRevocation {
  return typeof value === 'string' && (APPLE_REVOCATIONS as readonly string[]).includes(value)
}

/** Whether the account signs in with Apple, and so has tokens to revoke. */
export function hasAppleSignIn(user: { providerData: readonly { providerId: string }[] }): boolean {
  return user.providerData.some((p) => p.providerId === 'apple.com')
}

/**
 * cancelled -- the member backed out of Apple's sheet or popup: nothing is sent
 * mismatch  -- they confirmed with a different Apple ID: nothing is sent
 * done      -- send the request, with what happened to the tokens
 */
export type AppleDeletionConfirmation = { status: 'cancelled' } | { status: 'mismatch' } | { status: 'done'; appleRevocation: AppleRevocation }

const CANCEL_CODES = new Set(['auth/popup-closed-by-user', 'auth/cancelled-popup-request', 'auth/user-cancelled'])
// The confirmation can't run here at all (popups refused, an in-app browser):
// the request still goes, and the member is told how to remove Landly in
// their Apple ID settings.
const UNAVAILABLE_CODES = new Set(['auth/popup-blocked', 'auth/operation-not-supported-in-this-environment'])

const codeOf = (err: unknown) => (err as { code?: unknown } | null)?.code

/** Sorts a failed Apple confirmation into what the form does next. */
export function confirmationFailure(err: unknown): AppleDeletionConfirmation {
  const code = codeOf(err)
  if (typeof code === 'string' && CANCEL_CODES.has(code)) return { status: 'cancelled' }
  if (code === 'auth/user-mismatch') return { status: 'mismatch' }
  if (typeof code === 'string' && UNAVAILABLE_CODES.has(code)) return { status: 'done', appleRevocation: 'unavailable' }
  return { status: 'done', appleRevocation: 'failed' }
}

/**
 * The browser path (website, Expo web build): Firebase's Apple popup confirms
 * the member again, and Firebase revokes the fresh access token with this
 * project's own Apple configuration (revokeAccessToken), so no Apple secret
 * lives anywhere in Landly.
 */
export async function confirmAndRevokeWithPopup(calls: {
  reauthenticate: () => Promise<UserCredential>
  accessTokenOf: (result: UserCredential) => string | null | undefined
  revoke: (accessToken: string) => Promise<void>
}): Promise<AppleDeletionConfirmation> {
  let result: UserCredential
  try {
    result = await calls.reauthenticate()
  } catch (err) {
    return confirmationFailure(err)
  }
  const accessToken = calls.accessTokenOf(result)
  if (!accessToken) return { status: 'done', appleRevocation: 'failed' }
  try {
    await calls.revoke(accessToken)
    return { status: 'done', appleRevocation: 'revoked' }
  } catch {
    return { status: 'done', appleRevocation: 'failed' }
  }
}

export const APPLE_REVOKE_TIMEOUT_MS = 15_000

/**
 * The native path's revocation (Option A): Firebase's own revoke endpoint
 * with Apple's authorization code (token type CODE), as Firebase's iOS SDK
 * does; Firebase exchanges the code and revokes it with this project's Apple
 * configuration. Swap this one function for a call to our own server route
 * (Option B: an Apple client secret signed with our key) if Firebase ever
 * stops accepting the code from a web client. True when Firebase confirmed.
 */
export async function revokeAppleAuthorizationCode({
  apiKey,
  idToken,
  authorizationCode,
}: {
  apiKey: string
  idToken: string
  authorizationCode: string
}): Promise<boolean> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), APPLE_REVOKE_TIMEOUT_MS)
  try {
    const res = await fetch(`https://identitytoolkit.googleapis.com/v2/accounts:revokeToken?key=${encodeURIComponent(apiKey)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ providerId: 'apple.com', tokenType: 'CODE', token: authorizationCode, idToken }),
      signal: controller.signal,
    })
    return res.ok
  } catch {
    return false
  } finally {
    clearTimeout(timer)
  }
}

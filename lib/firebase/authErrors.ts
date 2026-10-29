import { FirebaseError } from 'firebase/app'
import type { TranslationKey } from '../i18n/translations'

const MESSAGES: Record<string, string> = {
  'auth/email-already-in-use': 'Could not create an account. Please try again, or try signing in or resetting your password.',
  'auth/invalid-email': 'Please enter a valid email address.',
  'auth/weak-password': 'Password should be at least 6 characters.',
  'auth/invalid-credential': 'Incorrect email or password.',
  'auth/user-not-found': 'Incorrect email or password.',
  'auth/wrong-password': 'Incorrect email or password.',
  'auth/too-many-requests': 'Too many attempts. Please try again later.',
  'auth/popup-closed-by-user': 'Sign-in was cancelled.',
  // Apple or Google with an email that already has a Landly account made another way.
  // A Google or Apple session Firebase didn't mark verified (signInCustomer.ts signs it out).
  'auth/unverified-provider-email': "We couldn't confirm your email with that account. Please try again or sign in with your email.",
  'auth/account-exists-with-different-credential': 'An account with this email already exists. Sign in the way you first signed up.',
  'auth/expired-action-code': 'This link has expired. Please request a new one.',
  'auth/invalid-action-code': 'This link is invalid or has already been used.',
  'auth/requires-recent-login': 'Please sign in again to complete this action.',
}

export function getAuthErrorMessage(err: unknown): string {
  if (err instanceof FirebaseError) {
    return MESSAGES[err.code] ?? 'Something went wrong. Please try again.'
  }
  return 'Something went wrong. Please try again.'
}

// The sign-in screens (web AuthScreen, the app's login) show these in the
// member's language. A failure with no message of its own falls back to the
// generic one plus its code, e.g. "(auth/internal-error)", so a screenshot of
// it says what went wrong; the screens show the code left-to-right inside
// the sentence, so a Hebrew page doesn't scramble it.

export type AuthErrorProvider = 'google' | 'apple'
export type AuthErrorDescription = { key: TranslationKey; code: string | null }

const CODE_KEYS: Record<string, TranslationKey> = {
  'auth/popup-closed-by-user': 'autherr_cancelled',
  'auth/cancelled-popup-request': 'autherr_cancelled',
  'auth/user-cancelled': 'autherr_cancelled',
  'auth/popup-blocked': 'autherr_popupBlocked',
  'auth/network-request-failed': 'autherr_network',
  'auth/timeout': 'autherr_network',
  'auth/too-many-requests': 'autherr_tooMany',
  'auth/invalid-credential': 'autherr_badCredentials',
  'auth/user-not-found': 'autherr_badCredentials',
  'auth/wrong-password': 'autherr_badCredentials',
  'auth/invalid-email': 'autherr_invalidEmail',
  'auth/weak-password': 'autherr_weakPassword',
  'auth/email-already-in-use': 'autherr_emailInUse',
  'auth/account-exists-with-different-credential': 'autherr_accountExists',
  'auth/unverified-provider-email': 'autherr_unverifiedEmail',
  'auth/user-disabled': 'autherr_userDisabled',
  'auth/operation-not-allowed': 'autherr_methodUnavailable',
  'auth/web-storage-unsupported': 'autherr_storage',
  'auth/operation-not-supported-in-this-environment': 'autherr_storage',
  // expo-apple-authentication (the app's native Apple sheet).
  ERR_REQUEST_CANCELED: 'autherr_cancelled',
}

/** Backing out of Google's or Apple's sign-in: nothing to report. */
const CANCEL_CODES = new Set(['auth/popup-closed-by-user', 'auth/cancelled-popup-request', 'auth/user-cancelled', 'ERR_REQUEST_CANCELED'])

export function isAuthCancellation(err: unknown): boolean {
  const code = authErrorCode(err)
  return code !== null && CANCEL_CODES.has(code)
}

// The native Apple sheet failing (expo-apple-authentication). ERR_REQUEST_UNKNOWN
// is what iOS reports when the build lacks the Sign in with Apple entitlement
// (scripts/check-apple-oauth.mjs checks the local native project for it).
const NATIVE_APPLE_CODES = new Set([
  'ERR_REQUEST_UNKNOWN',
  'ERR_REQUEST_FAILED',
  'ERR_REQUEST_NOT_HANDLED',
  'ERR_REQUEST_INVALID_RESPONSE',
  'ERR_REQUEST_NOT_INTERACTIVE',
])

// Failures that only happen inside Google's or Apple's sign-in, said as that
// provider's (an Apple failure never talks about an email or password).
const PROVIDER_CODES = new Set(['auth/invalid-credential', 'auth/missing-or-invalid-nonce', 'auth/invalid-auth-event'])
const PROVIDER_KEYS: Record<AuthErrorProvider, TranslationKey> = { google: 'autherr_googleFailed', apple: 'autherr_appleFailed' }

/** The Firebase-style code on an error, if it has one. */
export function authErrorCode(err: unknown): string | null {
  const code = (err as { code?: unknown } | null)?.code
  return typeof code === 'string' && code ? code : null
}

/**
 * The message to show for a sign-in failure, and the code to show with it:
 * on the generic message, and on a Google or Apple failure. When Firebase
 * passed on the provider's own reason it follows the code, e.g.
 * "auth/invalid-credential · invalid_grant", so a member's screenshot is
 * enough to tell why without the browser's console.
 */
export function describeAuthError(err: unknown, options: { provider?: AuthErrorProvider | null } = {}): AuthErrorDescription {
  const code = authErrorCode(err)
  // Only an OAuth error name ("invalid_grant") goes on screen, never free text.
  const reason = authErrorDetail(err)?.error?.match(/^[a-z_]{1,40}$/i)?.[0]
  const shown = code && reason ? `${code} · ${reason}` : code
  if (code && NATIVE_APPLE_CODES.has(code)) return { key: 'autherr_appleFailed', code: shown }
  if (code && options.provider && PROVIDER_CODES.has(code)) return { key: PROVIDER_KEYS[options.provider], code: shown }
  const key = code ? CODE_KEYS[code] : undefined
  return key ? { key, code: null } : { key: 'autherr_generic', code: shown }
}

export type AuthErrorDetail = {
  error: string | null
  errorDescription: string | null
  redirectUri: string | null
  audience: string | null
  expectedAudience: string | null
}

function decodeParam(value: string | undefined): string | null {
  if (!value) return null
  try {
    return decodeURIComponent(value.replace(/\+/g, ' '))
  } catch {
    return value
  }
}

/**
 * Why Google or Apple refused, for the log. When Firebase can't redeem the
 * provider's code it puts the provider's answer in the error message
 * ("... OAuth2 redirect uri is: https://.../__/auth/handler, response:
 * OAuth2TokenResponse{params: error=invalid_grant&error_description=...");
 * the message carries no token or code. When it refuses an identity token
 * for its audience ("The audience in ID Token [com.amitbd.landlyapp] does
 * not match the expected audience com.amitbd.landlyapp.web.dev." -- the app's
 * native Apple sheet, when the project has no iOS app with that bundle ID)
 * it names both. Null when there's nothing more than the code.
 */
export function authErrorDetail(err: unknown): AuthErrorDetail | null {
  const message = (err as { message?: unknown } | null)?.message
  if (typeof message !== 'string') return null
  const detail = {
    error: message.match(/[{\s,&]error=([^&,}\s]+)/)?.[1] ?? null,
    errorDescription: decodeParam(message.match(/error_description=([^&,}\s]+)/)?.[1]),
    redirectUri: message.match(/redirect uri is:\s*([^\s,]+)/i)?.[1] ?? null,
    audience: message.match(/audience in ID Token \[([^\]\s]+)\]/)?.[1] ?? null,
    expectedAudience: message.match(/expected audience ([^\s,()]+?)\.?(?=[\s,()]|$)/)?.[1] ?? null,
  }
  return Object.values(detail).some(Boolean) ? detail : null
}

/** One console line for a failed sign-in: the code, the message, and the provider's reason when there is one. */
export function logAuthError(err: unknown): void {
  const message = (err as { message?: unknown } | null)?.message
  console.warn('[auth] sign-in failed:', {
    code: authErrorCode(err),
    message: typeof message === 'string' ? message : String(err),
    ...authErrorDetail(err),
  })
}

/**
 * Plain text with the code appended between Unicode isolates (for React
 * Native Text, which has no <bdi>): "(auth/internal-error)" keeps its order
 * in a Hebrew sentence and the sentence keeps its own full stop.
 */
export function withIsolatedCode(text: string, code: string | null): string {
  return code ? `${text} ⁦(${code})⁩` : text
}

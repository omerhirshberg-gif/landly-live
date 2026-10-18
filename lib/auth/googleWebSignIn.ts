import { FirebaseError } from 'firebase/app'
import {
  getRedirectResult,
  setPersistence,
  signInWithPopup,
  signInWithRedirect,
  type Persistence,
} from 'firebase/auth'
import { auth, googleProvider } from '@/lib/firebase/config'
import { finishCustomerGoogleSignIn, type CustomerSignInResult } from '@/lib/auth/signInCustomer'
import type { Lang } from '@/lib/i18n/translations'

// "Continue with Google" on the website (the native app uses
// landly-mobile/src/auth/googleSignIn.ts; the Expo web build its own popup).
//
// The popup comes first everywhere: it keeps the page, and so any state on
// it, alive. Where a browser refuses popups, it falls back to a full-page
// redirect; AuthScreen picks the result up on the way back with
// completeGoogleRedirect(). Both only work reliably on mobile because the
// auth helper is served first-party (lib/firebase/authDomain.ts); the
// redirect marker below covers hosts where it isn't.

/** Popup failures that a redirect can get past; everything else (a closed popup, a network error) is reported. */
export const REDIRECT_FALLBACK_CODES: ReadonlySet<string> = new Set([
  'auth/popup-blocked',
  'auth/operation-not-supported-in-this-environment',
])

export function shouldFallBackToRedirect(err: unknown): boolean {
  const code = (err as { code?: unknown } | null)?.code
  return typeof code === 'string' && REDIRECT_FALLBACK_CODES.has(code)
}

export type GoogleWebSignInOutcome =
  | { kind: 'signedIn'; result: CustomerSignInResult }
  // The page is navigating to Google; the result arrives on the next load.
  | { kind: 'redirecting' }

// Set just before leaving for Google, so the page that comes back knows a
// result is due. Browsers that partition storage can lose the SDK's own
// redirect state on the way (getRedirectResult then resolves null, throws, or
// never settles) while the session itself survives in IndexedDB; the marker
// is what lets that session still go through the customer rules.
const REDIRECT_MARKER_KEY = 'landly_google_redirect'
const REDIRECT_MARKER_TTL_MS = 10 * 60 * 1000
/** How long the return from Google waits on getRedirectResult before deciding without it. */
export const REDIRECT_RESULT_TIMEOUT_MS = 8000

function setRedirectMarker(): void {
  try {
    sessionStorage.setItem(REDIRECT_MARKER_KEY, String(Date.now()))
  } catch {
    // Storage blocked: getRedirectResult alone decides
  }
}

function clearRedirectMarker(): void {
  try {
    sessionStorage.removeItem(REDIRECT_MARKER_KEY)
  } catch {
    // Storage blocked: nothing was stored
  }
}

/** Whether this page load is the return from a Google redirect started here (within the last few minutes). */
export function hasPendingGoogleRedirect(now = Date.now()): boolean {
  try {
    const startedAt = Number(sessionStorage.getItem(REDIRECT_MARKER_KEY))
    return startedAt > 0 && now - startedAt < REDIRECT_MARKER_TTL_MS
  } catch {
    return false
  }
}

export async function startGoogleWebSignIn(lang: Lang, persistence: Persistence): Promise<GoogleWebSignInOutcome> {
  await setPersistence(auth, persistence)
  let credential
  try {
    credential = await signInWithPopup(auth, googleProvider)
  } catch (err) {
    if (!shouldFallBackToRedirect(err)) throw err
    // Persistence set above carries over to the user the redirect signs in.
    setRedirectMarker()
    try {
      await signInWithRedirect(auth, googleProvider)
    } catch (redirectErr) {
      clearRedirectMarker()
      throw redirectErr
    }
    return { kind: 'redirecting' }
  }
  return { kind: 'signedIn', result: await finishCustomerGoogleSignIn(credential, lang) }
}

const TIMED_OUT = Symbol('timedOut')

/**
 * After a redirect sign-in: the same customer rules as the popup path, or
 * null when this load isn't one. Never waits on getRedirectResult longer
 * than REDIRECT_RESULT_TIMEOUT_MS. When the result is lost but a redirect
 * was started here and a Google session was restored, that session is the
 * result; when it was started here and nothing came back, it throws.
 */
export async function completeGoogleRedirect(lang: Lang): Promise<CustomerSignInResult | null> {
  const expected = hasPendingGoogleRedirect()
  clearRedirectMarker()
  const pending = getRedirectResult(auth)
  // A result that loses the race (or fails after it) is dropped, not left unhandled.
  pending.catch(() => undefined)
  let timer: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<typeof TIMED_OUT>((resolve) => {
    timer = setTimeout(() => resolve(TIMED_OUT), REDIRECT_RESULT_TIMEOUT_MS)
  })
  let failure: unknown = null
  let credential = null
  try {
    const outcome = await Promise.race([pending, timeout])
    if (outcome !== TIMED_OUT) credential = outcome
    else if (expected) failure = new FirebaseError('auth/timeout', 'Google sign-in did not finish in time')
  } catch (err) {
    failure = err
  } finally {
    clearTimeout(timer)
  }
  if (credential) return finishCustomerGoogleSignIn(credential, lang)
  if (expected) {
    // The session is persisted locally, so reading it never depends on the lost state.
    await auth.authStateReady()
    const user = auth.currentUser
    if (user?.providerData.some((p) => p.providerId === 'google.com')) return finishCustomerGoogleSignIn({ user }, lang)
  }
  if (failure) throw failure
  return null
}

// In-app browsers (Instagram, Facebook, LinkedIn, TikTok, Snapchat, LINE,
// X, generic Android WebViews and bare iOS WKWebViews) are refused by Google
// itself ("Error 403: disallowed_useragent"), whatever the flow, so the
// screen tells the member to open the page in their browser instead. The
// Google app (GSA) is a real browser for this purpose and is let through.
const IN_APP_MARKERS = /FBAN|FBAV|FB_IAB|FBIOS|Instagram|LinkedInApp|TikTok|musical_ly|BytedanceWebview|Snapchat|\bLine\/|Twitter|\bwv\)/i

export function isEmbeddedBrowser(userAgent: string | null | undefined): boolean {
  if (!userAgent) return false
  if (/\bGSA\//.test(userAgent)) return false
  if (IN_APP_MARKERS.test(userAgent)) return true
  // iOS: every real browser (Safari, Chrome, Firefox, Edge, ...) says
  // "Safari/"; an app's bare WKWebView doesn't.
  return /\b(iPhone|iPad|iPod)\b/.test(userAgent) && /AppleWebKit/.test(userAgent) && !/Safari\//.test(userAgent)
}

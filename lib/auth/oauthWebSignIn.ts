import { FirebaseError } from 'firebase/app'
import {
  getRedirectResult,
  setPersistence,
  signInWithPopup,
  signInWithRedirect,
  type Persistence,
  type UserCredential,
} from 'firebase/auth'
import { appleProvider, auth, googleProvider } from '@/lib/firebase/config'
import { appleNamesFromWebResult } from '@/lib/auth/appleName'
import { finishCustomerOAuthSignIn, type CustomerSignInResult } from '@/lib/auth/signInCustomer'
import type { Lang } from '@/lib/i18n/translations'

// "Continue with Google" and "Continue with Apple" on the website (the native
// app uses landly-mobile/src/auth/googleSignIn.ts and appleSignIn.ts; the Expo
// web build its own popups).
//
// The popup comes first everywhere: it keeps the page, and so any state on
// it, alive. Where a browser refuses popups, it falls back to a full-page
// redirect; AuthScreen picks the result up on the way back with
// completeOAuthRedirect(). Both only work reliably on mobile because the
// auth helper is served first-party (lib/firebase/authDomain.ts); the
// redirect marker below covers hosts where it isn't.

export type OAuthWebProvider = 'google' | 'apple'

const PROVIDER_IDS: Record<OAuthWebProvider, string> = { google: 'google.com', apple: 'apple.com' }

// Apple's sign-in page in the member's language.
const APPLE_LOCALES: Record<Lang, string> = { en: 'en_US', he: 'he_IL', ru: 'ru_RU', es: 'es_ES', fr: 'fr_FR' }

/** The Apple provider, its page in the member's language (also used to confirm an account deletion). */
export function appleProviderIn(lang: Lang) {
  appleProvider.setCustomParameters({ locale: APPLE_LOCALES[lang] ?? 'en_US' })
  return appleProvider
}

function providerFor(provider: OAuthWebProvider, lang: Lang) {
  return provider === 'google' ? googleProvider : appleProviderIn(lang)
}

/** Popup failures that a redirect can get past; everything else (a closed popup, a network error) is reported. */
export const REDIRECT_FALLBACK_CODES: ReadonlySet<string> = new Set([
  'auth/popup-blocked',
  'auth/operation-not-supported-in-this-environment',
])

export function shouldFallBackToRedirect(err: unknown): boolean {
  const code = (err as { code?: unknown } | null)?.code
  return typeof code === 'string' && REDIRECT_FALLBACK_CODES.has(code)
}

export type OAuthWebSignInOutcome =
  | { kind: 'signedIn'; result: CustomerSignInResult }
  // The page is navigating to Google or Apple; the result arrives on the next load.
  | { kind: 'redirecting' }

// Set just before leaving for the provider ("<provider>:<started at>"), so
// the page that comes back knows a result is due, and from whom. Browsers
// that partition storage can lose the SDK's own redirect state on the way
// (getRedirectResult then resolves null, throws, or never settles) while the
// session itself survives in IndexedDB; the marker is what lets that session
// still go through the customer rules.
const REDIRECT_MARKER_KEY = 'landly_oauth_redirect'
const REDIRECT_MARKER_TTL_MS = 10 * 60 * 1000
/** How long the return from the provider waits on getRedirectResult before deciding without it. */
export const REDIRECT_RESULT_TIMEOUT_MS = 8000

function setRedirectMarker(provider: OAuthWebProvider): void {
  try {
    sessionStorage.setItem(REDIRECT_MARKER_KEY, `${provider}:${Date.now()}`)
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

/** Which provider this page load is the return from, if a redirect was started here within the last few minutes. */
export function pendingOAuthRedirect(now = Date.now()): OAuthWebProvider | null {
  try {
    const [provider, startedAt] = (sessionStorage.getItem(REDIRECT_MARKER_KEY) ?? '').split(':')
    if (provider !== 'google' && provider !== 'apple') return null
    const age = now - Number(startedAt)
    return Number(startedAt) > 0 && age < REDIRECT_MARKER_TTL_MS ? provider : null
  } catch {
    return null
  }
}

// The shared customer rules, with Apple's first-time name when it came along.
function finish(provider: OAuthWebProvider, cred: Pick<UserCredential, 'user'>, lang: Lang): Promise<CustomerSignInResult> {
  return finishCustomerOAuthSignIn(cred, lang, provider === 'apple' ? { names: appleNamesFromWebResult(cred) } : {})
}

export async function startOAuthWebSignIn(provider: OAuthWebProvider, lang: Lang, persistence: Persistence): Promise<OAuthWebSignInOutcome> {
  await setPersistence(auth, persistence)
  const authProvider = providerFor(provider, lang)
  let credential
  try {
    credential = await signInWithPopup(auth, authProvider)
  } catch (err) {
    if (!shouldFallBackToRedirect(err)) throw err
    // Persistence set above carries over to the user the redirect signs in.
    setRedirectMarker(provider)
    try {
      await signInWithRedirect(auth, authProvider)
    } catch (redirectErr) {
      clearRedirectMarker()
      throw redirectErr
    }
    return { kind: 'redirecting' }
  }
  return { kind: 'signedIn', result: await finish(provider, credential, lang) }
}

const TIMED_OUT = Symbol('timedOut')

const providerOf = (providerId: string | null | undefined): OAuthWebProvider | null =>
  providerId === 'apple.com' ? 'apple' : providerId === 'google.com' ? 'google' : null

/**
 * After a redirect sign-in: the same customer rules as the popup path, or
 * null when this load isn't one. Never waits on getRedirectResult longer
 * than REDIRECT_RESULT_TIMEOUT_MS. When the result is lost but a redirect
 * was started here and that provider's session was restored, that session is
 * the result; when it was started here and nothing came back, it throws.
 */
export async function completeOAuthRedirect(lang: Lang): Promise<{ provider: OAuthWebProvider; result: CustomerSignInResult } | null> {
  const expected = pendingOAuthRedirect()
  clearRedirectMarker()
  const pending = getRedirectResult(auth)
  // A result that loses the race (or fails after it) is dropped, not left unhandled.
  pending.catch(() => undefined)
  let timer: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<typeof TIMED_OUT>((resolve) => {
    timer = setTimeout(() => resolve(TIMED_OUT), REDIRECT_RESULT_TIMEOUT_MS)
  })
  let failure: unknown = null
  let credential: UserCredential | null = null
  try {
    const outcome = await Promise.race([pending, timeout])
    if (outcome !== TIMED_OUT) credential = outcome
    else if (expected) failure = new FirebaseError('auth/timeout', 'Sign-in did not finish in time')
  } catch (err) {
    failure = err
  } finally {
    clearTimeout(timer)
  }
  if (credential) {
    const provider = providerOf(credential.providerId) ?? expected ?? 'google'
    return { provider, result: await finish(provider, credential, lang) }
  }
  if (expected) {
    // The session is persisted locally, so reading it never depends on the lost state.
    await auth.authStateReady()
    const user = auth.currentUser
    // Apple's name came with the lost result, so this member is greeted without one.
    if (user?.providerData.some((p) => p.providerId === PROVIDER_IDS[expected])) {
      return { provider: expected, result: await finish(expected, { user }, lang) }
    }
  }
  if (failure) throw failure
  return null
}

// In-app browsers (Instagram, Facebook, LinkedIn, TikTok, Snapchat, LINE,
// X, generic Android WebViews and bare iOS WKWebViews) are refused by Google
// itself ("Error 403: disallowed_useragent"), whatever the flow, and can't
// open Apple's popup either, so the screen tells the member to open the page
// in their browser instead. The Google app (GSA) is a real browser for this
// purpose and is let through.
const IN_APP_MARKERS = /FBAN|FBAV|FB_IAB|FBIOS|Instagram|LinkedInApp|TikTok|musical_ly|BytedanceWebview|Snapchat|\bLine\/|Twitter|\bwv\)/i

export function isEmbeddedBrowser(userAgent: string | null | undefined): boolean {
  if (!userAgent) return false
  if (/\bGSA\//.test(userAgent)) return false
  if (IN_APP_MARKERS.test(userAgent)) return true
  // iOS: every real browser (Safari, Chrome, Firefox, Edge, ...) says
  // "Safari/"; an app's bare WKWebView doesn't.
  return /\b(iPhone|iPad|iPod)\b/.test(userAgent) && /AppleWebKit/.test(userAgent) && !/Safari\//.test(userAgent)
}

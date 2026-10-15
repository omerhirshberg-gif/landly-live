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
// auth helper is served first-party (lib/firebase/authDomain.ts).

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

export async function startGoogleWebSignIn(lang: Lang, persistence: Persistence): Promise<GoogleWebSignInOutcome> {
  await setPersistence(auth, persistence)
  let credential
  try {
    credential = await signInWithPopup(auth, googleProvider)
  } catch (err) {
    if (!shouldFallBackToRedirect(err)) throw err
    // Persistence set above carries over to the user the redirect signs in.
    await signInWithRedirect(auth, googleProvider)
    return { kind: 'redirecting' }
  }
  return { kind: 'signedIn', result: await finishCustomerGoogleSignIn(credential, lang) }
}

/** After a redirect sign-in: the same customer rules as the popup path, or null when this load isn't one. */
export async function completeGoogleRedirect(lang: Lang): Promise<CustomerSignInResult | null> {
  const credential = await getRedirectResult(auth)
  return credential ? finishCustomerGoogleSignIn(credential, lang) : null
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

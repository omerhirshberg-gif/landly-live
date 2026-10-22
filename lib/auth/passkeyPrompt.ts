// When the website offers "Save a passkey for faster sign-in next time"
// (components/auth/PasskeyPrompt.tsx): once after a password or Google
// sign-in on this tab (a sign-up's first sign-in included, after the
// onboarding wizard), never after a passkey sign-in, and not again for 30
// days after "Not now" or ✕ for that account on this browser. The rest
// (WebAuthn support, no passkey on the account yet) is checked live.

export const PASSKEY_PROMPT_SNOOZE_MS = 30 * 24 * 60 * 60 * 1000

// Per tab: a sign-in here makes the offer due; showing it uses it up.
const DUE_KEY = 'landly.passkeyOfferDue'
const snoozeKey = (uid: string) => `landly.passkeyPromptSnoozed.${uid}`

// Pages where the card would get in the way: signing in, checkout, staff areas.
const HIDDEN_PREFIXES = ['/login', '/signup', '/forgot-password', '/reset-password', '/verify-email', '/checkout', '/admin', '/business']

export function isPasskeyPromptPage(pathname: string): boolean {
  return !HIDDEN_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))
}

export function isSnoozed(snoozedAt: string | null, now = Date.now()): boolean {
  const at = Number(snoozedAt)
  return Number.isFinite(at) && at > 0 && now - at < PASSKEY_PROMPT_SNOOZE_MS
}

/** Called after a password or Google sign-in on the sign-in screen. */
export function markPasskeyOfferDue(uid: string) {
  try {
    window.sessionStorage.setItem(DUE_KEY, uid)
  } catch {
    // Storage blocked: no offer this time; Settings still has Passkeys.
  }
}

export function isPasskeyOfferDue(uid: string): boolean {
  try {
    return window.sessionStorage.getItem(DUE_KEY) === uid
  } catch {
    return false
  }
}

export function clearPasskeyOffer() {
  try {
    window.sessionStorage.removeItem(DUE_KEY)
  } catch {
    // Nothing to clear.
  }
}

export function isPasskeyPromptSnoozed(uid: string, now = Date.now()): boolean {
  try {
    return isSnoozed(window.localStorage.getItem(snoozeKey(uid)), now)
  } catch {
    return false
  }
}

export function snoozePasskeyPrompt(uid: string, now = Date.now()) {
  try {
    window.localStorage.setItem(snoozeKey(uid), String(now))
  } catch {
    // Storage blocked: the offer is per sign-in anyway.
  }
}

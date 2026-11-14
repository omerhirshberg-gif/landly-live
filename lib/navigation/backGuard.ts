// What Android's back button / system back does on the screens that must not
// be left by accident (landly-mobile/src/lib/useBackGuard.ts applies these).
// Each returns what to do; 'default' leaves it to the navigator. Pure, so the
// rules are tested on their own.

/** Checkout: paying waits for the payment, the card step returns to the summary, the summary just goes back. */
export function checkoutBack({ paying, step }: { paying: boolean; step: 'summary' | 'payment' }): 'swallow' | 'to-summary' | 'default' {
  if (paying) return 'swallow'
  if (step === 'payment') return 'to-summary'
  return 'default'
}

/** Whether a checkout screen may be swiped away: not while paying, not on the card step. */
export function checkoutSwipeAllowed({ paying, step }: { paying: boolean; step: 'summary' | 'payment' }): boolean {
  return !paying && step === 'summary'
}

/** The onboarding wizard: a step back when there is one, nothing on the first card (never out of the app). */
export function wizardBack(canGoBack: boolean): 'step-back' | 'swallow' {
  return canGoBack ? 'step-back' : 'swallow'
}

/** The sign-in screen: the email check returns to sign-in, sign-up returns to sign-in, sign-in itself stays (nothing is behind it). */
export function authBack({ pending, mode }: { pending: boolean; mode: 'signIn' | 'signUp' }): 'to-sign-in' | 'swallow' {
  return pending || mode === 'signUp' ? 'to-sign-in' : 'swallow'
}

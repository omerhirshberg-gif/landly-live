import { ONBOARDING_STEPS, type OnboardingStep } from './onboarding'
import type { TranslationKey } from '@/lib/i18n/translations'

// The step list on the desktop brand panel (components/auth/entrance/
// AuthBrandPanel.tsx), as pure data so the states can be tested. Email and
// Google members get the same onboarding list; only the account journey
// before it differs, since Google and Apple accounts are verified by them.

/**
 * What the form side is showing: a tab, the "check your inbox" card, the
 * verification link's landing page once it worked, a password-reset screen
 * (/forgot-password, /reset-password and its success page), or an onboarding
 * card.
 */
export type BrandPanelContext = 'signIn' | 'signUp' | 'verify' | 'verified' | 'reset' | OnboardingStep

/** How the member got (or is getting) their account. */
export type SignInMethod = 'email' | 'google' | 'apple'

export type StepState = 'done' | 'current' | 'upcoming'

export type BrandPanelSteps = { label: TranslationKey; items: { label: TranslationKey; state: StepState }[] }

/** The wizard's questions; the welcome and celebration cards aren't steps of their own. */
export const ONBOARDING_STEP_ITEMS: readonly { step: OnboardingStep; label: TranslationKey }[] = [
  { step: 'language', label: 'onb_step_language' },
  { step: 'persona', label: 'onb_step_persona' },
  { step: 'origin', label: 'onb_step_origin' },
  { step: 'phone', label: 'onb_step_phone' },
  { step: 'notifications', label: 'onb_step_notifications' },
]

const JOURNEY: readonly TranslationKey[] = ['auth_panel_step_account', 'auth_panel_step_verify', 'auth_panel_step_personalize']

const stateOf = (i: number, current: number): StepState => (i < current ? 'done' : i === current ? 'current' : 'upcoming')

/**
 * The step list beside the form: none on Sign In or password reset (a member
 * resetting a password is past the journey); the account journey on Sign
 * Up and around verification (a Google or Apple sign-up has nothing to verify, so it's
 * already at Personalize); the setup cards during onboarding — all upcoming
 * on the welcome, earlier ones done on each question, all done on the
 * celebration.
 */
export function brandPanelSteps(context: BrandPanelContext, via: SignInMethod = 'email'): BrandPanelSteps | null {
  if (context === 'signIn' || context === 'reset') return null
  if (context === 'signUp' || context === 'verify' || context === 'verified') {
    const current = via !== 'email' || context === 'verified' ? 2 : context === 'verify' ? 1 : 0
    return { label: 'auth_panel_journey', items: JOURNEY.map((label, i) => ({ label, state: stateOf(i, current) })) }
  }
  const at = ONBOARDING_STEPS.indexOf(context)
  return {
    label: 'onb_panel_steps',
    items: ONBOARDING_STEP_ITEMS.map(({ step, label }) => ({ label, state: stateOf(ONBOARDING_STEPS.indexOf(step), at) })),
  }
}

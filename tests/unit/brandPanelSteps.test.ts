import { describe, expect, it } from 'vitest'
import { brandPanelSteps, ONBOARDING_STEP_ITEMS, type SignInMethod } from '@/lib/auth/brandPanelSteps'
import { ONBOARDING_STEPS, type OnboardingStep } from '@/lib/auth/onboarding'

const states = (context: Parameters<typeof brandPanelSteps>[0], via?: SignInMethod) =>
  brandPanelSteps(context, via)?.items.map((item) => item.state)

describe('brandPanelSteps', () => {
  it('shows no step list on Sign In', () => {
    expect(brandPanelSteps('signIn')).toBeNull()
  })

  it('shows no step list on the password-reset screens', () => {
    expect(brandPanelSteps('reset')).toBeNull()
  })

  it('walks the email account journey: create, verify, personalize', () => {
    expect(states('signUp')).toEqual(['current', 'upcoming', 'upcoming'])
    expect(states('verify')).toEqual(['done', 'current', 'upcoming'])
    expect(states('verified')).toEqual(['done', 'done', 'current'])
  })

  it('skips verification for Google sign-ups', () => {
    expect(states('signUp', 'google')).toEqual(['done', 'done', 'current'])
  })

  it('lists every wizard question once, in wizard order', () => {
    const steps = ONBOARDING_STEP_ITEMS.map((item) => item.step)
    expect(steps).toEqual(ONBOARDING_STEPS.filter((s) => s !== 'welcome' && s !== 'done'))
  })

  const expected: Record<OnboardingStep, string[]> = {
    welcome: ['upcoming', 'upcoming', 'upcoming', 'upcoming', 'upcoming'],
    language: ['current', 'upcoming', 'upcoming', 'upcoming', 'upcoming'],
    persona: ['done', 'current', 'upcoming', 'upcoming', 'upcoming'],
    origin: ['done', 'done', 'current', 'upcoming', 'upcoming'],
    phone: ['done', 'done', 'done', 'current', 'upcoming'],
    notifications: ['done', 'done', 'done', 'done', 'current'],
    done: ['done', 'done', 'done', 'done', 'done'],
  }

  for (const step of ONBOARDING_STEPS) {
    it(`marks the onboarding steps on the ${step} card the same for email and Google`, () => {
      expect(states(step, 'email')).toEqual(expected[step])
      expect(states(step, 'google')).toEqual(expected[step])
    })
  }
})

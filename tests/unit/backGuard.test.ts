import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { authBack, checkoutBack, checkoutSwipeAllowed, wizardBack } from '@/lib/navigation/backGuard'

// What Android's back button does on the screens that must not be left by accident.

describe('checkout back', () => {
  it('waits while paying, returns from the card to the summary, and otherwise goes back', () => {
    expect(checkoutBack({ paying: true, step: 'summary' })).toBe('swallow')
    expect(checkoutBack({ paying: true, step: 'payment' })).toBe('swallow')
    expect(checkoutBack({ paying: false, step: 'payment' })).toBe('to-summary')
    expect(checkoutBack({ paying: false, step: 'summary' })).toBe('default')
  })

  it('allows the swipe only on the summary and not mid-payment', () => {
    expect(checkoutSwipeAllowed({ paying: false, step: 'summary' })).toBe(true)
    expect(checkoutSwipeAllowed({ paying: true, step: 'summary' })).toBe(false)
    expect(checkoutSwipeAllowed({ paying: false, step: 'payment' })).toBe(false)
    expect(checkoutSwipeAllowed({ paying: true, step: 'payment' })).toBe(false)
  })
})

describe('onboarding and sign-in back', () => {
  it('steps back through the wizard and stays on its first card', () => {
    expect(wizardBack(true)).toBe('step-back')
    expect(wizardBack(false)).toBe('swallow')
  })

  it('returns sign-up and the email check to sign-in, and never leaves the app from sign-in', () => {
    expect(authBack({ pending: false, mode: 'signUp' })).toBe('to-sign-in')
    expect(authBack({ pending: true, mode: 'signIn' })).toBe('to-sign-in')
    expect(authBack({ pending: true, mode: 'signUp' })).toBe('to-sign-in')
    expect(authBack({ pending: false, mode: 'signIn' })).toBe('swallow')
  })
})

describe('where the guards are installed', () => {
  const read = (path: string) => readFileSync(path, 'utf8')

  it('guards the wizard, sign-in, the checkout, the order confirmation and the app lock', () => {
    expect(read('landly-mobile/src/auth/onboarding/OnboardingWizard.tsx')).toContain("wizardBack(goBack !== null)")
    expect(read('landly-mobile/src/app/(auth)/login.tsx')).toContain('authBack({ pending: !!pending, mode })')
    expect(read('landly-mobile/src/app/checkout/[offerId].tsx')).toContain('useFocusedBackGuard')
    expect(read('landly-mobile/src/app/order-success/[orderId].tsx')).toContain("router.navigate('/wallet')")
    expect(read('landly-mobile/src/auth/AppLock.tsx')).toContain('useBackGuard(() => true, locked || covered)')
  })

  it('only acts on Android, where the button exists', () => {
    expect(read('landly-mobile/src/lib/useBackGuard.ts')).toContain("Platform.OS !== 'android'")
  })
})

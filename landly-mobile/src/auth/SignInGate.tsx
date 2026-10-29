import { createContext, useContext, useState, type ReactNode } from 'react'

// Firebase reports the user as signed in the moment the password checks out
// -- before signInCustomer has had the chance to reject a business or an
// unverified account and sign it back out. The login screen holds this gate
// closed while those checks run, so the tabs never mount for a session
// that's about to be dropped. `onboarding` holds it closed longer: a member
// whose profile is incomplete is signed in, but has the onboarding cards
// (language, persona, WhatsApp, notifications) to finish first.
const SignInGateContext = createContext<{
  checking: boolean
  setChecking: (v: boolean) => void
  onboarding: boolean
  setOnboarding: (v: boolean) => void
} | null>(null)

export function SignInGateProvider({ children }: { children: ReactNode }) {
  const [checking, setChecking] = useState(false)
  const [onboarding, setOnboarding] = useState(false)
  return (
    <SignInGateContext.Provider value={{ checking, setChecking, onboarding, setOnboarding }}>{children}</SignInGateContext.Provider>
  )
}

/**
 * Whether the root navigator may show the tabs: a verified session, no
 * sign-in check under way, no onboarding cards still owed (the login screen's
 * hold, or the auth provider's answer). The same for every sign-in method.
 */
export function rootSignedIn(state: {
  verified: boolean
  checking: boolean
  onboarding: boolean
  onboardingComplete: boolean | null
}): boolean {
  return state.verified && !state.checking && !state.onboarding && state.onboardingComplete !== false
}

export function useSignInGate() {
  const ctx = useContext(SignInGateContext)
  if (!ctx) throw new Error('useSignInGate must be used within a SignInGateProvider')
  return ctx
}

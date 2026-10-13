import { createContext, useContext, useState, type ReactNode } from 'react'

// Firebase reports the user as signed in the moment the password checks out
// -- before signInCustomer has had the chance to reject a business or an
// unverified account and sign it back out. The login screen holds this gate
// closed while those checks run, so the tabs never mount for a session
// that's about to be dropped.
const SignInGateContext = createContext<{ checking: boolean; setChecking: (v: boolean) => void } | null>(null)

export function SignInGateProvider({ children }: { children: ReactNode }) {
  const [checking, setChecking] = useState(false)
  return <SignInGateContext.Provider value={{ checking, setChecking }}>{children}</SignInGateContext.Provider>
}

export function useSignInGate() {
  const ctx = useContext(SignInGateContext)
  if (!ctx) throw new Error('useSignInGate must be used within a SignInGateProvider')
  return ctx
}

'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/firebase/useAuth'

/**
 * Keeps a signed-in member who hasn't finished onboarding off member pages:
 * a reload mid-wizard (or a typed URL) sends them back to /login, where
 * AuthScreen resumes the wizard at the card they left. True while the page
 * should hold its content back — the answer is still being read, or the
 * redirect is on its way — so a member page never flashes first.
 */
export function useOnboardingGuard(): boolean {
  const { user, onboardingComplete } = useAuth()
  const router = useRouter()
  const gated = !!user?.emailVerified
  const incomplete = gated && onboardingComplete === false

  useEffect(() => {
    if (incomplete) router.replace('/login')
  }, [incomplete, router])

  return gated && onboardingComplete !== true
}

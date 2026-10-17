'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import type { User } from 'firebase/auth'
import { useAuth } from '@/lib/firebase/useAuth'
import { useOnboardingGuard } from '@/components/auth/useOnboardingGuard'

// The signed-in member a members-only settings page (Privacy & Security,
// Delete Account, Country of origin) works on, or null while auth settles.
// Guests are sent to /login; a member mid-onboarding is sent back to the
// wizard by the guard and gets null until that's settled.
export function useSettingsMember(): User | null {
  const { user, loading } = useAuth()
  const held = useOnboardingGuard()
  const router = useRouter()

  useEffect(() => {
    if (!loading && !user) router.replace('/login')
  }, [loading, user, router])

  return loading || held ? null : user
}

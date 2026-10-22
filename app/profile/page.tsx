'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Navbar from '@/components/layout/Navbar'
import MemberPageShell, { PageTitle } from '@/components/layout/MemberPageShell'
import ProfileSection from '@/components/profile/ProfileSection'
import { useLang } from '@/lib/i18n/useLang'
import { useAuth } from '@/lib/firebase/useAuth'
import { useOnboardingGuard } from '@/components/auth/useOnboardingGuard'

// The member's profile (/profile; /account redirects here, next.config.js).
// Personal details only: language and region, password, sessions and the
// account-deletion request all live under /settings.
export default function ProfilePage() {
  const { t } = useLang()
  const { user, loading } = useAuth()
  // Onboarding first: a member mid-wizard is sent back to it.
  const held = useOnboardingGuard()
  const router = useRouter()

  useEffect(() => {
    if (!loading && !user) router.replace('/login')
  }, [loading, user, router])

  if (loading || !user || held) {
    return (
      <>
        <Navbar />
        <div className="below-header member-canvas" />
      </>
    )
  }

  return (
    <>
      <Navbar />
      <div className="below-header member-canvas">
        <MemberPageShell>
          {/* A form reads better narrow; no auto margins, so it keeps the column's start edge */}
          <div className="max-w-3xl lg:max-w-4xl">
            <PageTitle>{t('nav_profile')}</PageTitle>
            <ProfileSection user={user} />
          </div>
        </MemberPageShell>
      </div>
    </>
  )
}

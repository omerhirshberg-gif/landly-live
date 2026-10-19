'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Navbar from '@/components/layout/Navbar'
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
        <div className="max-w-3xl lg:max-w-4xl mx-auto px-5 sm:px-6 py-8 sm:py-10">
          <div className="mb-6">
            <div className="text-xs font-semibold tracking-wider text-slate-400 uppercase mb-1">{t('dash_label')}</div>
            <h1 className="text-[26px] sm:text-[28px] lg:text-3xl leading-tight font-bold text-ink">{t('nav_profile')}</h1>
          </div>

          <ProfileSection user={user} />
        </div>
      </div>
    </>
  )
}

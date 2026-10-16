'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Navbar from '@/components/layout/Navbar'
import ProfileSection from '@/components/account/ProfileSection'
import LanguageSection from '@/components/account/LanguageSection'
import { useLang } from '@/lib/i18n/useLang'
import { useAuth } from '@/lib/firebase/useAuth'
import { useOnboardingGuard } from '@/components/auth/useOnboardingGuard'

export default function AccountPage() {
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
        <div className="pt-16 member-canvas" />
      </>
    )
  }

  return (
    <>
      <Navbar />
      <div className="pt-16 member-canvas">
        <div className="max-w-3xl mx-auto px-5 sm:px-6 py-8 sm:py-10">
          <div className="mb-6">
            <div className="text-xs font-bold tracking-widest text-brand uppercase mb-1">{t('dash_label')}</div>
            <h1 className="text-[26px] sm:text-[28px] lg:text-3xl leading-tight font-bold text-ink">{t('nav_account')}</h1>
          </div>

          {/* Personal details only: password and sign-in live in Privacy &
              Security (components/account/SecurityDialog.tsx), opened from the
              avatar menu or the drawer. */}
          <div className="space-y-6">
            <ProfileSection user={user} />
            <LanguageSection user={user} />
          </div>
        </div>
      </div>
    </>
  )
}

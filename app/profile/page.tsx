'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { signOut } from 'firebase/auth'
import Navbar from '@/components/layout/Navbar'
import MemberPageShell, { PageTitle } from '@/components/layout/MemberPageShell'
import ProfileSection from '@/components/profile/ProfileSection'
import SignOutRow from '@/components/profile/SignOutRow'
import { auth } from '@/lib/firebase/config'
import { endWebSession } from '@/lib/account/webSession'
import { useLang } from '@/lib/i18n/useLang'
import { useAuth } from '@/lib/firebase/useAuth'
import { useOnboardingGuard } from '@/components/auth/useOnboardingGuard'
import BrandLoader from '@/components/ui/BrandLoader'

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
        <div className="below-header member-canvas flex flex-col">
          <BrandLoader size="lg" fill />
        </div>
      </>
    )
  }

  return (
    <>
      <Navbar />
      <div className="below-header member-canvas">
        <MemberPageShell>
          {/* A form reads better narrow on phones and tablets (the card is two panes from 600px). From 1024px two cards fill the member column, on the same rails as the navbar. No auto margins, so it keeps the column's start edge */}
          <div className="max-w-3xl fold:max-w-5xl lg:max-w-none">
            <PageTitle>{t('nav_profile')}</PageTitle>
            <ProfileSection user={user} />
            {/* Below the profile card, as in the app: a calm destructive row, the same sign-out as the account menu. */}
            <div className="mt-6 lg:mx-auto lg:max-w-sm">
              <SignOutRow
                onSignOut={async () => {
                  // This browser leaves the member's device list (Privacy & Security › Sessions).
                  await endWebSession(user.uid)
                  await signOut(auth)
                  router.push('/')
                }}
              />
            </div>
          </div>
        </MemberPageShell>
      </div>
    </>
  )
}

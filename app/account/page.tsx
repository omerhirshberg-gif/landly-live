'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Navbar from '@/components/layout/Navbar'
import AccountTabs, { AccountTab } from '@/components/account/AccountTabs'
import ProfileSection from '@/components/account/ProfileSection'
import LanguageSection from '@/components/account/LanguageSection'
import SecuritySection from '@/components/account/SecuritySection'
import { useLang } from '@/lib/i18n/useLang'
import { useAuth } from '@/lib/firebase/useAuth'

export default function AccountPage() {
  const { t } = useLang()
  const { user, loading } = useAuth()
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<AccountTab>('profile')

  useEffect(() => {
    if (!loading && !user) router.replace('/login')
  }, [loading, user, router])

  if (loading || !user) {
    return (
      <>
        <Navbar />
        <div className="pt-16 min-h-screen bg-slate-50" />
      </>
    )
  }

  // Google-only accounts have no password to change, so no Security tab — and
  // with only Profile left, the tab bar is hidden entirely.
  const hasPasswordProvider = user.providerData.some((p) => p.providerId === 'password')

  return (
    <>
      <Navbar />
      <div className="pt-16 bg-slate-50 min-h-screen">
        <div className="max-w-3xl mx-auto px-5 sm:px-6 py-8 sm:py-10">
          <div className="mb-6">
            <div className="text-xs font-bold tracking-widest text-brand uppercase mb-1">{t('dash_label')}</div>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900">{t('nav_account')}</h1>
          </div>

          {/* Tabs: Profile / Security */}
          {hasPasswordProvider && (
            <div className="mb-5">
              <AccountTabs active={activeTab} onChange={setActiveTab} />
            </div>
          )}
          {activeTab === 'profile' && (
            <div className="space-y-6">
              <ProfileSection user={user} />
              <LanguageSection user={user} />
            </div>
          )}
          {activeTab === 'security' && hasPasswordProvider && <SecuritySection user={user} />}
        </div>
      </div>
    </>
  )
}

'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Navbar from '@/components/layout/Navbar'
import ProfileTab from '@/components/account/ProfileTab'
import { useLang } from '@/lib/i18n/useLang'
import { useAuth } from '@/lib/firebase/useAuth'

export default function AccountPage() {
  const { t } = useLang()
  const { user, loading } = useAuth()
  const router = useRouter()

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

  return (
    <>
      <Navbar />
      <div className="pt-16 bg-slate-50 min-h-screen">
        <div className="max-w-3xl mx-auto px-5 sm:px-6 py-8 sm:py-10">
          <div className="mb-6">
            <div className="text-xs font-bold tracking-widest text-brand uppercase mb-1">{t('dash_label')}</div>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900">{t('nav_account')}</h1>
          </div>

          <ProfileTab user={user} />
        </div>
      </div>
    </>
  )
}

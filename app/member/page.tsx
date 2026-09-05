'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import Navbar from '@/components/layout/Navbar'
import MemberTabs, { MemberTab } from '@/components/member/MemberTabs'
import PerksTab from '@/components/member/PerksTab'
import RedeemedTab from '@/components/member/RedeemedTab'
import SubscriptionTab from '@/components/member/SubscriptionTab'
import SupportTab from '@/components/member/SupportTab'
import ProfileTab from '@/components/member/ProfileTab'
import { useLang } from '@/lib/i18n/useLang'
import { useAuth } from '@/lib/firebase/useAuth'

export default function MemberPage() {
  const { t } = useLang()
  const { user, loading } = useAuth()
  const router = useRouter()
  const [toast, setToast] = useState<string | null>(null)
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [activeTab, setActiveTab] = useState<MemberTab>('perks')

  useEffect(() => {
    if (!loading && !user) router.replace('/login')
  }, [loading, user, router])

  const displayName = user?.displayName?.trim() || user?.email?.split('@')[0] || ''
  const welcomeMessage = displayName
    ? t('dash_welcome').replace('{name}', displayName)
    : t('dash_welcome_generic')

  const showToast = (message: string) => {
    setToast(message)
    if (toastTimer.current) clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(null), 2600)
  }

  useEffect(() => () => { if (toastTimer.current) clearTimeout(toastTimer.current) }, [])

  const showSegmentInfo = () => showToast(t('dash_segment_toast'))

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
      <div className="pt-16 bg-slate-50">
        <div className="max-w-3xl mx-auto px-5 sm:px-6 py-8 sm:py-10">

          <div className="flex items-start justify-between mb-6 gap-3">
            <div>
              <div className="text-xs font-bold tracking-widest text-brand uppercase mb-1">{t('dash_label')}</div>
              <h1 className="text-2xl sm:text-3xl font-black text-slate-900">{welcomeMessage}</h1>
              <div className="flex flex-wrap items-center gap-2 mt-2.5">
                <span className="segment-badge">
                  <i className="fa-solid fa-passport"></i>
                  <span>{t('dash_segment_value')}</span>
                </span>
                <button onClick={showSegmentInfo} className="segment-hint">
                  <span>{t('dash_segment_hint')}</span>
                  <i className="fa-solid fa-chevron-down text-[9px]"></i>
                </button>
              </div>
            </div>
          </div>

          {/* Snapshot stats: Card status / Savings / Raffle entries */}
          <div className="grid grid-cols-3 gap-2.5 sm:gap-4 mb-5">
            <div className="dash-stat-card text-center">
              <i className="fa-solid fa-gift text-brand text-base sm:text-lg mb-1.5 sm:mb-2"></i>
              <div className="text-[10px] sm:text-xs text-slate-500 font-semibold leading-tight">{t('dash_perks_redeemed_label')}</div>
              <div className="text-xs sm:text-base font-black text-slate-900">0</div>
            </div>
            <div className="dash-stat-card text-center">
              <i className="fa-solid fa-sack-dollar text-emerald-600 text-base sm:text-lg mb-1.5 sm:mb-2"></i>
              <div className="text-[10px] sm:text-xs text-slate-500 font-semibold leading-tight">{t('dash_total_saved')}</div>
              <div className="text-xs sm:text-base font-black text-slate-900" dir="ltr">₪0</div>
            </div>
            <div className="dash-stat-card text-center">
              <i className="fa-solid fa-ticket text-amber-500 text-base sm:text-lg mb-1.5 sm:mb-2"></i>
              <div className="text-[10px] sm:text-xs text-slate-500 font-semibold leading-tight">{t('dash_raffle_entries_label')}</div>
              <div className="text-xs sm:text-base font-black text-slate-900">{t('dash_raffle_entries_value')}</div>
            </div>
          </div>

          {/* Raffle note */}
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 mb-8 flex items-center gap-3">
            <i className="fa-solid fa-champagne-glasses text-amber-500 text-xl flex-shrink-0"></i>
            <p className="text-sm text-amber-800"><strong>{t('perks_raffle_entered')}</strong> <span>{t('perks_raffle_note')}</span></p>
          </div>

          {/* Tabs: My Perks / Redeemed / Subscription / Support / Profile */}
          <div className="mb-5">
            <MemberTabs active={activeTab} onChange={setActiveTab} />
          </div>
          <div className="mb-4">
            {activeTab === 'perks' && <PerksTab />}
            {activeTab === 'redeemed' && <RedeemedTab />}
            {activeTab === 'subscription' && <SubscriptionTab user={user} />}
            {activeTab === 'support' && <SupportTab />}
            {activeTab === 'profile' && <ProfileTab user={user} />}
          </div>

          <div className="mt-10 text-center sm:hidden">
            <Link href="/" className="tap-target inline-flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-red-600 transition">
              <i className="fa-solid fa-arrow-right-from-bracket"></i> <span>{t('dash_back_public')}</span>
            </Link>
          </div>
        </div>
      </div>

      <div className={`toast-msg ${toast ? 'show' : ''}`}>{toast}</div>
    </>
  )
}

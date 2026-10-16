'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Navbar from '@/components/layout/Navbar'
import MemberTabs, { MemberTab } from '@/components/member/MemberTabs'
import PerksTab from '@/components/member/PerksTab'
import RedeemedTab from '@/components/member/RedeemedTab'
import { useLang } from '@/lib/i18n/useLang'
import { useAuth } from '@/lib/firebase/useAuth'
import { useOnboardingGuard } from '@/components/auth/useOnboardingGuard'
import { getUserDocument } from '@/lib/firebase/users'
import { greetingName } from '@/lib/auth/names'
import { CUSTOMER_TYPES, CUSTOMER_TYPE_UNSET_COLOR, customerTypeLabel } from '@/lib/customerTypes'

export default function MemberPage() {
  const { t } = useLang()
  const { user, loading } = useAuth()
  // Onboarding first: a member mid-wizard is sent back to it.
  const held = useOnboardingGuard()
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<MemberTab>('perks')
  const [customerType, setCustomerType] = useState('')
  const [customerTypeOther, setCustomerTypeOther] = useState('')
  const [greeting, setGreeting] = useState<string | null>(null)

  useEffect(() => {
    if (!loading && !user) router.replace('/login')
  }, [loading, user, router])

  useEffect(() => {
    if (!user) return
    let cancelled = false
    getUserDocument(user.uid).then((doc) => {
      if (cancelled) return
      setCustomerType(doc?.customerType ?? '')
      setCustomerTypeOther(doc?.customerTypeOther ?? '')
      setGreeting(greetingName(doc, user.displayName))
    })
    return () => { cancelled = true }
  }, [user])

  const segmentOption = CUSTOMER_TYPES.find((o) => o.value === customerType)
  // "Other" shows what the member typed for it.
  const segmentLabel = customerTypeLabel(customerType, customerTypeOther, t) ?? t('dash_segment_value_unset')
  const segmentColor = segmentOption?.color ?? CUSTOMER_TYPE_UNSET_COLOR

  // First name from the profile, else the display name — never the email.
  const displayName = greeting ?? greetingName(null, user?.displayName)
  const welcomeMessage = displayName
    ? t('dash_welcome').replace('{name}', displayName)
    : t('dash_welcome_generic')

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

          <div className="flex items-start justify-between mb-6 gap-3">
            <div>
              <div className="text-xs font-bold tracking-widest text-brand uppercase mb-1">{t('dash_label')}</div>
              <h1 className="text-[26px] sm:text-[28px] lg:text-3xl leading-tight font-bold text-ink">{welcomeMessage}</h1>
              <div className="flex flex-wrap items-center gap-2 mt-2.5">
                <span className="segment-badge" style={{ background: segmentColor }}>
                  <span>{segmentLabel}</span>
                </span>
              </div>
            </div>
          </div>

          {/* Snapshot stats: Active perks / Perks redeemed / Savings */}
          <div className="grid grid-cols-3 gap-2.5 sm:gap-4 mb-5">
            <div className="dash-stat-card text-center">
              <i className="fa-solid fa-tags text-cyan-600 text-base sm:text-lg mb-1.5 sm:mb-2"></i>
              <div className="text-[10px] sm:text-xs text-slate-500 font-semibold leading-tight">{t('dash_active_perks_label')}</div>
              <div className="text-xs sm:text-base font-black text-slate-900">0</div>
            </div>
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
          </div>

          {/* Tabs: My Perks / Redeemed */}
          <div className="mb-5">
            <MemberTabs active={activeTab} onChange={setActiveTab} />
          </div>
          <div className="mb-4">
            {activeTab === 'perks' && <PerksTab />}
            {activeTab === 'redeemed' && <RedeemedTab />}
          </div>
        </div>
      </div>
    </>
  )
}

'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Navbar from '@/components/layout/Navbar'
import MemberTabs, { MemberTab } from '@/components/member/MemberTabs'
import PerksTab from '@/components/member/PerksTab'
import RedeemedTab from '@/components/member/RedeemedTab'
import DashboardStats from '@/components/member/DashboardStats'
import { useLang } from '@/lib/i18n/useLang'
import { useAuth } from '@/lib/firebase/useAuth'
import { useOnboardingGuard } from '@/components/auth/useOnboardingGuard'
import { getUserDocument } from '@/lib/firebase/users'
import { subscribeToUserVouchers, type VoucherDocument } from '@/lib/firebase/vouchers'
import { totalSaved } from '@/lib/member/savings'
import { greetingName } from '@/lib/auth/names'
import SegmentBadge from '@/components/member/SegmentBadge'

type Voucher = VoucherDocument & { id: string }

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
  // Live, shared by the stats row and both tabs (same listeners as the app's
  // My Pass): a purchase or a redemption shows up without a reload. null
  // while loading; a refused read leaves the lists empty.
  const [active, setActive] = useState<Voucher[] | null>(null)
  const [redeemed, setRedeemed] = useState<Voucher[] | null>(null)
  const [saved, setSaved] = useState<number | null>(null)

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

  useEffect(() => {
    if (!user) return
    const stopActive = subscribeToUserVouchers(user.uid, 'active', setActive, () => setActive([]))
    const stopRedeemed = subscribeToUserVouchers(user.uid, 'redeemed', setRedeemed, () => setRedeemed([]))
    return () => {
      stopActive()
      stopRedeemed()
    }
  }, [user])

  useEffect(() => {
    if (!redeemed) return
    let cancelled = false
    totalSaved(redeemed)
      .then((amount) => {
        if (!cancelled) setSaved(amount)
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [redeemed])

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
        <div className="max-w-3xl lg:max-w-4xl mx-auto px-5 sm:px-6 py-8 sm:py-10">

          <div className="flex items-start justify-between mb-6 gap-3">
            <div>
              <div className="text-xs font-semibold tracking-wider text-slate-400 uppercase mb-1">{t('dash_label')}</div>
              <h1 className="text-[26px] sm:text-[28px] lg:text-3xl leading-tight font-bold text-ink">{welcomeMessage}</h1>
              <div className="flex flex-wrap items-center gap-2 mt-2.5">
                <SegmentBadge customerType={customerType} customerTypeOther={customerTypeOther} />
              </div>
            </div>
          </div>

          {/* Snapshot stats: Active perks / Perks redeemed / Savings */}
          <DashboardStats activePerks={active?.length ?? null} redeemed={redeemed?.length ?? null} saved={saved} />

          {/* Tabs: My Perks / Redeemed */}
          <div className="mb-5">
            <MemberTabs active={activeTab} onChange={setActiveTab} />
          </div>
          <div className="mb-4">
            {activeTab === 'perks' && <PerksTab vouchers={active} />}
            {activeTab === 'redeemed' && <RedeemedTab vouchers={redeemed} />}
          </div>
        </div>
      </div>
    </>
  )
}

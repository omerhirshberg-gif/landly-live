'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Navbar from '@/components/layout/Navbar'
import MemberPageShell, { PAGE_TITLE } from '@/components/layout/MemberPageShell'
import MemberTabs, { MemberTab } from '@/components/member/MemberTabs'
import PerksTab from '@/components/member/PerksTab'
import RedeemedTab from '@/components/member/RedeemedTab'
import DashboardStats from '@/components/member/DashboardStats'
import { useLang } from '@/lib/i18n/useLang'
import { useAuth } from '@/lib/firebase/useAuth'
import { useOnboardingGuard } from '@/components/auth/useOnboardingGuard'
import { getUserDocument } from '@/lib/firebase/users'
import { useVouchers } from '@/lib/firebase/VouchersProvider'
import type { VoucherDocument } from '@/lib/firebase/vouchers'
import { totalSaved } from '@/lib/member/savings'
import { greetingName } from '@/lib/auth/names'
import SegmentBadge from '@/components/member/SegmentBadge'

type Voucher = VoucherDocument & { id: string }
const NO_VOUCHERS: Voucher[] = []

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
  const vouchers = useVouchers({ redeemed: true })
  const active = vouchers.active ?? (vouchers.failed ? NO_VOUCHERS : null)
  const redeemed = vouchers.redeemed ?? (vouchers.failed ? NO_VOUCHERS : null)
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

  // Savings count from purchase (lib/member/savings.ts): active and redeemed passes alike.
  useEffect(() => {
    if (!user || !active || !redeemed) return
    let cancelled = false
    totalSaved(user.uid, [...active, ...redeemed])
      .then((amount) => {
        if (!cancelled) setSaved(amount)
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [user, active, redeemed])

  // First name from the profile, else the display name — never the email.
  const displayName = greeting ?? greetingName(null, user?.displayName)
  const welcomeMessage = displayName
    ? t('dash_welcome').replace('{name}', displayName)
    : t('dash_welcome_generic')

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
          {/* One top-to-bottom flow on every screen, as in the app's My Pass: the greeting
              and persona, the three stats in one row, the tabs, then the passes, centred
              in a 960px column. */}
          <div className="mx-auto w-full max-w-[960px] space-y-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h1 className={PAGE_TITLE}>{welcomeMessage}</h1>
                <div className="flex flex-wrap items-center gap-2 mt-2.5">
                  <SegmentBadge customerType={customerType} customerTypeOther={customerTypeOther} />
                </div>
              </div>
            </div>

            {/* Snapshot stats: Active perks / Perks redeemed / Savings */}
            <DashboardStats activePerks={active?.length ?? null} redeemed={redeemed?.length ?? null} saved={saved} />

            {/* Tabs: My Perks / Redeemed, the full width of the column */}
            <MemberTabs active={activeTab} onChange={setActiveTab} />

            <div>
              {activeTab === 'perks' && <PerksTab vouchers={active} />}
              {activeTab === 'redeemed' && <RedeemedTab vouchers={redeemed} />}
            </div>
          </div>
        </MemberPageShell>
      </div>
    </>
  )
}

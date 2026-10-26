'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Navbar from '@/components/layout/Navbar'
import MemberPageShell, { PAGE_TITLE, PAGE_TITLE_GAP } from '@/components/layout/MemberPageShell'
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
import SectionDivider from '@/components/ui/SectionDivider'

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

  // Savings count from purchase (lib/member/savings.ts): active and redeemed passes alike.
  useEffect(() => {
    if (!active || !redeemed) return
    let cancelled = false
    totalSaved([...active, ...redeemed])
      .then((amount) => {
        if (!cancelled) setSaved(amount)
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [active, redeemed])

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
          {/* Phones and tablets: one column (title, stats, hairline, tabs,
              passes). From 1024px the stats move into a sticky rail beside
              the passes, so the full member column is used instead of a
              narrow strip with empty space beside it. The rail spans all
              three rows; the last row is 1fr, so the rail's height never
              pushes the title and the tabs apart. */}
          <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_300px] lg:grid-rows-[auto_auto_1fr] lg:gap-x-10">
            <div className={`flex items-start justify-between ${PAGE_TITLE_GAP} gap-3 lg:col-start-1 lg:row-start-1`}>
              <div>
                <h1 className={PAGE_TITLE}>{welcomeMessage}</h1>
                <div className="flex flex-wrap items-center gap-2 mt-2.5">
                  <SegmentBadge customerType={customerType} customerTypeOther={customerTypeOther} />
                </div>
              </div>
            </div>

            {/* Snapshot stats: Active perks / Perks redeemed / Savings */}
            <aside className="lg:col-start-2 lg:row-start-1 lg:row-span-3 lg:self-start lg:sticky lg:top-[calc(var(--header-offset)+1.5rem)]">
              <DashboardStats activePerks={active?.length ?? null} redeemed={redeemed?.length ?? null} saved={saved} />
            </aside>

            {/* A soft hairline between the member's status and their passes, as on the home page; the rail separates them on wide screens. */}
            <SectionDivider className="mb-6 lg:hidden" />

            {/* Tabs: My Perks / Redeemed */}
            <div className="mb-5 lg:col-start-1 lg:row-start-2">
              <MemberTabs active={activeTab} onChange={setActiveTab} />
            </div>
            <div className="mb-4 lg:col-start-1 lg:row-start-3">
              {activeTab === 'perks' && <PerksTab vouchers={active} />}
              {activeTab === 'redeemed' && <RedeemedTab vouchers={redeemed} />}
            </div>
          </div>
        </MemberPageShell>
      </div>
    </>
  )
}

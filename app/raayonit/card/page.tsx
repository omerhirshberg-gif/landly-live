'use client'

import { Suspense, useMemo } from 'react'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import Navbar from '@/components/layout/Navbar'
import MemberPageShell, { MemberColumn, PageTitle } from '@/components/layout/MemberPageShell'
import RaayonitHero from '@/components/raayonit/RaayonitHero'
import RaayonitCardDetails from '@/components/raayonit/RaayonitCardDetails'
import { useLang } from '@/lib/i18n/useLang'
import { isFlagship, isRaayonitOffer } from '@/lib/offers/discoverTab'
import { RAAYONIT_HUB } from '@/lib/offers/offerRoutes'
import { useOffers } from '@/lib/offers/useOffers'

// The step between the hub's "Order voucher" and checkout (native: landly-mobile/src/app/raayonit-card.tsx): the card with its three values to
// choose from and "Continue to order", then what the voucher is, how to redeem it and the businesses that accept it. `?variant=` (a pool id)
// or `?denomination=` (a value in shekels) pre-selects a value; otherwise the highest value is.
function Details() {
  const { t } = useLang()
  const { offers } = useOffers()
  const raayonit = useMemo(() => (offers ?? []).filter(isRaayonitOffer), [offers])
  const flagship = useMemo(() => raayonit.find(isFlagship) ?? null, [raayonit])
  const chains = useMemo(() => raayonit.filter((o) => !isFlagship(o)), [raayonit])
  return (
    <MemberPageShell fluid>
      <MemberColumn wide>
        <div className="mx-auto w-full max-w-6xl">
          <Link href={RAAYONIT_HUB} className="tap-target mb-2 inline-flex items-center gap-1 text-sm font-semibold text-brand">
            <ChevronLeft aria-hidden="true" className="h-4 w-4 rtl:-scale-x-100" strokeWidth={2} />
            {t('raayonit_page_title')}
          </Link>
          <PageTitle>{t('raayonit_details_title')}</PageTitle>
          <RaayonitHero offer={flagship} buy step="details" />
        </div>
      </MemberColumn>
      <RaayonitCardDetails offer={flagship} chains={chains} />
    </MemberPageShell>
  )
}

export default function RaayonitCardPage() {
  return (
    <>
      <Navbar />
      <div className="below-header member-canvas">
        <Suspense fallback={null}><Details /></Suspense>
      </div>
    </>
  )
}

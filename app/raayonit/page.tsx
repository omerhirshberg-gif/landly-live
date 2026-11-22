'use client'

import { Suspense, useMemo } from 'react'
import { useSearchParams } from 'next/navigation'
import Navbar from '@/components/layout/Navbar'
import MemberPageShell, { MemberColumn, PageTitle } from '@/components/layout/MemberPageShell'
import BrandLogoWall from '@/components/home/BrandLogoWall'
import RaayonitHero from '@/components/raayonit/RaayonitHero'
import RaayonitTab from '@/components/raayonit/RaayonitTab'
import { useLang } from '@/lib/i18n/useLang'
import { isFlagship, isRaayonitOffer } from '@/lib/offers/discoverTab'
import { useOffers } from '@/lib/offers/useOffers'

// The Raayonit Card and every business that accepts it (native: landly-mobile/src/app/raayonit.tsx): the purchase block with a direct
// Buy action, then the search, all 18 Raayonit categories and the full grid. `?category=` pre-selects a category.
function Catalog() {
  const { t } = useLang()
  const params = useSearchParams()
  const { offers } = useOffers()
  const raayonit = useMemo(() => (offers ?? []).filter(isRaayonitOffer), [offers])
  const flagship = useMemo(() => raayonit.find(isFlagship) ?? null, [raayonit])
  const chains = useMemo(() => raayonit.filter((o) => !isFlagship(o)), [raayonit])
  const category = params.get('category') ?? undefined
  return (
    <MemberPageShell fluid>
      <MemberColumn wide>
        <div className="mx-auto w-full max-w-6xl">
          <PageTitle>{t('raayonit_page_title')}</PageTitle>
          <RaayonitHero offer={flagship} buy />
          <div className="mt-10 mb-8"><BrandLogoWall offers={chains} rail byBranches title={t('raayonit_popular_title')} /></div>
        </div>
      </MemberColumn>
      <div className="pb-28 sm:pb-12">
        <RaayonitTab key={category ?? 'all'} offers={chains} initialCategory={category} />
      </div>
    </MemberPageShell>
  )
}

export default function RaayonitPage() {
  return (
    <>
      <Navbar />
      <div className="below-header member-canvas">
        <Suspense fallback={null}><Catalog /></Suspense>
      </div>
    </>
  )
}

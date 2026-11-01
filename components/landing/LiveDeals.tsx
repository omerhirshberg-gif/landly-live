'use client'

import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import OfferCard from '@/components/discover/OfferCard'
import { RailArrows } from '@/components/discover/OfferCardRail'
import { LANDING_COLUMN, LANDING_RAIL } from '@/components/landing/landingColumn'
import SnapDots, { SNAP_DOTS_MAX } from '@/components/ui/SnapDots'
import type { OfferDocument } from '@/lib/firebase/offers'
import { useLang } from '@/lib/i18n/useLang'
import { useRailPaging } from '@/lib/useRailPaging'
import { useSnapIndex } from '@/lib/useSnapIndex'

// Real deals on the same dual-image card members see (components/discover/
// OfferCard.tsx), always in one sideways row with the member rails' arrows and
// dots, the next card peeking in; a tile into the catalogue closes the row, so
// a few deals end cleanly instead of leaving it open. A guest can open any of
// them; signing in comes at the purchase bar.
export default function LiveDeals({ deals }: { deals: OfferDocument[] }) {
  const { t } = useLang()

  return (
    <section id="deals" aria-labelledby="landing-deals-title" className="py-8 sm:py-10 lg:py-12">
      <div className={`mb-5 flex flex-wrap items-baseline justify-between gap-3 ${LANDING_COLUMN}`}>
        <h2 id="landing-deals-title" className="text-2xl font-black tracking-tight text-ink sm:text-3xl">{t('landing_deals_title')}</h2>
        <SeeAllLink />
      </div>
      <DealsRail deals={deals} />
    </section>
  )
}

function SeeAllLink() {
  const { t } = useLang()
  return (
    <Link href="/categories" className="tap-target inline-flex items-center gap-1.5 text-sm font-bold text-brand [@media(hover:hover)]:hover:underline">
      {t('landing_see_all')}
      <ArrowRight aria-hidden="true" className="h-4 w-4 rtl:-scale-x-100" strokeWidth={2} />
    </Link>
  )
}

function SeeAllTile() {
  const { t } = useLang()
  return (
    <Link
      href="/categories"
      className="flex w-[clamp(240px,72vw,260px)] flex-col items-center justify-center gap-3 rounded-2xl border border-slate-200/80 bg-gradient-to-br from-blue-50/40 to-indigo-50/20 p-6 text-center shadow-[0_4px_20px_-4px_rgba(0,0,0,0.07)] transition-transform duration-200 ease-out-expo [@media(hover:hover)]:hover:-translate-y-0.5 focus-visible:ring-2 focus-visible:ring-brand/40 motion-reduce:transform-none"
    >
      <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white/90 ring-1 ring-slate-200/80">
        <ArrowRight aria-hidden="true" className="h-5 w-5 text-brand rtl:-scale-x-100" strokeWidth={1.75} />
      </span>
      <span className="text-base font-extrabold tracking-tight text-ink">{t('landing_see_all')}</span>
    </Link>
  )
}

function DealsRail({ deals }: { deals: OfferDocument[] }) {
  // The tile takes a slot of its own.
  const slots = deals.length + 1
  const { ref: railRef, index: active, scrollTo } = useSnapIndex<HTMLDivElement>(slots)
  const { edges, measure, page, overflowing } = useRailPaging(railRef, slots)

  return (
    <>
      <div className={`offer-rail relative ${LANDING_COLUMN}`}>
        <div ref={railRef} onScroll={measure} className={`${LANDING_RAIL} edge-fade flex flex-row gap-3 overflow-x-auto touch-pan-x touch-pan-y touch-pinch-zoom overscroll-x-contain snap-x snap-mandatory scrollbar-none pb-3 pt-1 sm:gap-4`}>
          {deals.map((offer) => (
            <div key={offer.id} className="flex shrink-0 snap-start">
              <OfferCard offer={offer} />
            </div>
          ))}
          <div className="flex shrink-0 snap-start">
            <SeeAllTile />
          </div>
        </div>
        {overflowing && <RailArrows edges={edges} page={page} />}
      </div>
      {slots <= SNAP_DOTS_MAX && <SnapDots count={slots} active={active} onSelect={scrollTo} className="sm:hidden" />}
    </>
  )
}

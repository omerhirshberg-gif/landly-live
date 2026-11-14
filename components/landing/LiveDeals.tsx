'use client'

import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import OfferCard from '@/components/discover/OfferCard'
import { RailArrows } from '@/components/discover/OfferCardRail'
import { LANDING_COLUMN, LANDING_RAIL } from '@/components/landing/landingColumn'
import SnapDots, { SNAP_DOTS_MAX } from '@/components/ui/SnapDots'
import type { OfferDocument } from '@/lib/firebase/offers'
import { useLang } from '@/lib/i18n/useLang'
import { useAutoAdvance } from '@/lib/useAutoAdvance'
import { useRailPaging } from '@/lib/useRailPaging'
import { useSnapIndex } from '@/lib/useSnapIndex'

// Real deals on the same dual-image card members see (components/discover/
// OfferCard.tsx), always in one sideways row with the member rails' arrows and
// dots, the next card peeking in, moving on by itself (lib/useAutoAdvance.ts). "See all" lives once, in the heading row, so
// the row ends on its last real deal, never on an empty slot. A guest can open any of
// them; signing in comes at the purchase bar.
export default function LiveDeals({ deals }: { deals: OfferDocument[] }) {
  const { t } = useLang()

  return (
    <section id="deals" aria-labelledby="landing-deals-title" className="py-8 sm:py-10 lg:py-12">
      <div className={`mb-5 flex flex items-baseline justify-between gap-3 ${LANDING_COLUMN}`}>
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

function DealsRail({ deals }: { deals: OfferDocument[] }) {
  const slots = deals.length
  const { ref: railRef, index: active, scrollTo } = useSnapIndex<HTMLDivElement>(slots)
  const { edges, measure, page, overflowing } = useRailPaging(railRef, slots)
  // The same engine as the member rails: a card every 5 seconds, then back to the first, held still for a finger, a hovering mouse, focus, Reduce Motion, a hidden tab or an off-screen row.
  useAutoAdvance({ rowRef: railRef, count: slots, active, scrollTo })

  return (
    <>
      <div className={`offer-rail relative ${LANDING_COLUMN}`}>
        <div ref={railRef} onScroll={measure} className={`${LANDING_RAIL} edge-fade flex flex-row gap-3 overflow-x-auto touch-pan-x touch-pan-y touch-pinch-zoom overscroll-x-contain snap-x snap-mandatory scrollbar-none pb-3 pt-1 sm:gap-4`}>
          {deals.map((offer) => (
            <div key={offer.id} className="flex shrink-0 grow-0 snap-start">
              <OfferCard offer={offer} />
            </div>
          ))}
        </div>
        {overflowing && <RailArrows edges={edges} page={page} />}
      </div>
      {slots <= SNAP_DOTS_MAX && <SnapDots count={slots} active={active} onSelect={scrollTo} className="sm:hidden" />}
    </>
  )
}

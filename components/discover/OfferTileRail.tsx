'use client'

import { useId } from 'react'
import Link from 'next/link'
import { ChevronLeft, ChevronRight, type LucideIcon } from 'lucide-react'
import type { OfferDocument } from '@/lib/firebase/offers'
import { useAutoAdvance } from '@/lib/useAutoAdvance'
import { useRailPaging } from '@/lib/useRailPaging'
import { useSnapIndex } from '@/lib/useSnapIndex'
import SnapDots, { SNAP_DOTS_MAX } from '@/components/ui/SnapDots'
import OfferCard from './OfferCard'

// One of the /categories highlight rails (New on Landly, Best Sellers, stacked
// above the category grid): a heading row with "See more", then the perks as
// full OfferCards in one row that scrolls sideways. Momentum swipe on
// phones, snapping to a card's start; the rail bleeds through the page's
// 16px gutter on phones so cards scroll out from under the edge, and the
// scrollbar is hidden (wheel, trackpad, keyboard and touch still scroll it).
// From 640px with a real mouse, two chevrons in the heading row page it,
// fading out at either end. An RTL page fills and starts it from the right
// on its own; scrollLeft counts negative there, so distances are measured
// from the start edge and paging flips its sign. On phones a short rail
// (SNAP_DOTS_MAX cards or fewer) has pagination dots underneath.
export default function OfferTileRail({
  icon: Icon,
  title,
  offers,
  href,
  seeMore,
  autoAdvance = false,
  autoAdvanceOffsetMs = 0,
  compact = false,
}: {
  /** The heading's Lucide glyph, e.g. Award for Bestsellers. */
  icon: LucideIcon
  title: string
  offers: OfferDocument[]
  href?: string
  seeMore?: string
  /** Moves to the next card every 5 seconds (lib/useAutoAdvance.ts); the offset staggers it from the rail beside it. */
  autoAdvance?: boolean
  autoAdvanceOffsetMs?: number
  /** The dense desktop rail (as on Home): from 1024px every card is a fixed 280px that never stretches. */
  compact?: boolean
}) {
  const headingId = useId()
  const { ref: railRef, index: active, scrollTo } = useSnapIndex<HTMLDivElement>(offers.length)
  const { edges, measure, page, overflowing } = useRailPaging(railRef, offers.length)
  useAutoAdvance({ rowRef: railRef, count: offers.length, active, scrollTo, enabled: autoAdvance, offsetMs: autoAdvanceOffsetMs })

  return (
    <section aria-labelledby={headingId} className="py-5 first:pt-0 last:pb-0">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 id={headingId} className="flex min-w-0 flex-1 items-center gap-1.5 text-base font-bold text-slate-900">
          {/* A bare 18px line icon at 1.5 stroke: no frame. */}
          <Icon aria-hidden="true" className="h-[18px] w-[18px] shrink-0 text-ink" strokeWidth={1.5} />
          <span className="line-clamp-2 min-w-0 leading-tight">{title}</span>
        </h2>
        <div className="flex flex-shrink-0 items-center gap-2">
          {href && seeMore && (
            // 32px to the eye, 44px to the finger: the link is the target, the pill is its look.
            <Link href={href} className="tap-target group/pill inline-flex items-center">
              <span className="rounded-full border border-slate-200/70 bg-brandTint px-3.5 py-1.5 text-sm font-semibold text-brand transition-colors duration-200 group-focus-visible/pill:ring-2 group-focus-visible/pill:ring-brand/40 [@media(hover:hover)]:group-hover/pill:bg-brandLight">
                {seeMore}
              </span>
            </Link>
          )}
          {/* Mouse users have no swipe and no scrollbar: these page the rail. Hidden from AT (the cards are all in the tab order). */}
          {overflowing && (
            <>
              <button type="button" tabIndex={-1} aria-hidden="true" onClick={() => page(-1)} data-hidden={!edges.start || undefined} className="tile-rail-arrow">
                <ChevronLeft aria-hidden="true" className="h-4 w-4 rtl:-scale-x-100" strokeWidth={2} />
              </button>
              <button type="button" tabIndex={-1} aria-hidden="true" onClick={() => page(1)} data-hidden={!edges.end || undefined} className="tile-rail-arrow">
                <ChevronRight aria-hidden="true" className="h-4 w-4 rtl:-scale-x-100" strokeWidth={2} />
              </button>
            </>
          )}
        </div>
      </div>
      <div
        ref={railRef}
        onScroll={measure}
        className={`offer-tile-rail scrollbar-none edge-fade -mx-4 grid grid-flow-col auto-cols-[260px] gap-3 overflow-x-auto touch-pan-x touch-pan-y touch-pinch-zoom snap-x snap-mandatory scroll-px-4 px-4 pb-1 sm:mx-0 sm:auto-cols-[280px] sm:gap-4 sm:scroll-px-0 sm:px-0 ${compact ? 'lg:auto-cols-[280px]' : ''}`}
      >
        {offers.map((offer) => (
          <div key={offer.id} className="flex snap-start">
            <OfferCard offer={offer} layout="grid" showWishlistButton compact={compact} />
          </div>
        ))}
      </div>
      {offers.length > 1 && offers.length <= SNAP_DOTS_MAX && <SnapDots count={offers.length} active={active} onSelect={scrollTo} className="-mb-2 sm:hidden" />}
    </section>
  )
}

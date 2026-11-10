'use client'

import type { ReactNode } from 'react'
import Link from 'next/link'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { MemberColumn } from '@/components/layout/MemberPageShell'
import SnapDots, { SNAP_DOTS_MAX } from '@/components/ui/SnapDots'
import type { OfferDocument } from '@/lib/firebase/offers'
import { useRailPaging } from '@/lib/useRailPaging'
import { useSnapIndex } from '@/lib/useSnapIndex'
import OfferCard from './OfferCard'

/** The round paging arrows over a rail's ends. Hidden from AT: everything in the row is in the tab order. */
export function RailArrows({ edges, page }: { edges: { start: boolean; end: boolean }; page: (direction: 1 | -1) => void }) {
  return (
    <>
      <button type="button" tabIndex={-1} aria-hidden="true" onClick={() => page(-1)} data-side="start" data-hidden={!edges.start || undefined} className="offer-rail-arrow">
        <ChevronLeft aria-hidden="true" className="h-5 w-5 rtl:-scale-x-100" strokeWidth={2} />
      </button>
      <button type="button" tabIndex={-1} aria-hidden="true" onClick={() => page(1)} data-side="end" data-hidden={!edges.end || undefined} className="offer-rail-arrow">
        <ChevronRight aria-hidden="true" className="h-5 w-5 rtl:-scale-x-100" strokeWidth={2} />
      </button>
    </>
  )
}

// One rail of the member home: a heading on the member column, then full perk
// cards in a row that reaches the screen's edges (.member-bleed) with its first
// card on the column's line. A swipe settles on a card's start edge and the row
// never drags the page sideways; with a real mouse, arrows fade in on hover. On
// phones `dots` adds pagination dots under a short rail. Hebrew fills the row
// from the right through the page's direction.
export default function OfferCardRail({
  id,
  title,
  glyph,
  offers,
  href,
  seeAll,
  count,
  showCategoryBadge = true,
  dots = false,
}: {
  id: string
  title: string
  /** The heading's leading emoji. */
  glyph?: ReactNode
  offers: OfferDocument[]
  /** Both or neither: a category without a page has no link. */
  href?: string
  seeAll?: string
  /** The number of deals behind "See all", beside the title (not inside the link). */
  count?: number
  /** Off in a rail already scoped to one category, where every card would repeat it. */
  showCategoryBadge?: boolean
  dots?: boolean
}) {
  const { ref: railRef, index: active, scrollTo } = useSnapIndex<HTMLDivElement>(offers.length)
  const { edges, measure, page, overflowing } = useRailPaging(railRef, offers.length)

  return (
    <section aria-labelledby={id}>
      <MemberColumn className="mb-1 flex items-center justify-between gap-3">
        <h2 id={id} className="flex min-w-0 items-center gap-2.5 text-xl font-bold tracking-tight text-ink">
          {glyph && (
            <span aria-hidden="true" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-slate-200/70 bg-brandTint">
              {glyph}
            </span>
          )}
          <bdi className="truncate" dir="auto">{title}</bdi>
          {typeof count === 'number' && <bdi dir="ltr" className="shrink-0 text-sm font-semibold tabular-nums text-muted">{count}</bdi>}
        </h2>
        {href && seeAll && (
          // 32px to the eye, 44px to the finger: the link is the target, the pill is its look.
          <Link href={href} className="tap-target group/pill inline-flex shrink-0 items-center">
            <span className="rounded-full border border-slate-200/70 bg-brandTint px-3.5 py-1.5 text-sm font-semibold text-brand transition-colors duration-200 group-focus-visible/pill:ring-2 group-focus-visible/pill:ring-brand/40 [@media(hover:hover)]:group-hover/pill:bg-brandLight">
              {seeAll}
            </span>
          </Link>
        )}
      </MemberColumn>
      <div className="offer-rail relative">
        <div
          ref={railRef}
          onScroll={measure}
          className="member-bleed edge-fade flex gap-3 overflow-x-auto touch-pan-x touch-pan-y touch-pinch-zoom overscroll-x-contain snap-x snap-mandatory scrollbar-none pb-3 pt-1 sm:gap-4"
        >
          {offers.map((offer) => (
            <div key={offer.id} className="flex shrink-0 snap-start">
              <OfferCard offer={offer} showWishlistButton showCategoryBadge={showCategoryBadge} />
            </div>
          ))}
        </div>
        {overflowing && <RailArrows edges={edges} page={page} />}
      </div>
      {dots && offers.length > 1 && offers.length <= SNAP_DOTS_MAX && <SnapDots count={offers.length} active={active} onSelect={scrollTo} className="-mt-2 sm:hidden" />}
    </section>
  )
}

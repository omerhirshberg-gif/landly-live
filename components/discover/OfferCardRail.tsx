'use client'

import type { ReactNode } from 'react'
import Link from 'next/link'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { MemberColumn } from '@/components/layout/MemberPageShell'
import SnapDots, { SNAP_DOTS_MAX } from '@/components/ui/SnapDots'
import type { OfferDocument } from '@/lib/firebase/offers'
import { useRailPaging } from '@/lib/useRailPaging'
import { useAutoAdvance } from '@/lib/useAutoAdvance'
import { useSnapIndex } from '@/lib/useSnapIndex'
import OfferCard from './OfferCard'
import OfferCardPlaceholder from './OfferCardPlaceholder'

/**
 * The rail's paging arrows, set in its heading row (or, where the heading is elsewhere, `bar` on a row above it), never over the cards: arrows
 * on the cards invite a tap on a perk when the member reaches the end. Mouse only (the CSS hides them on touch); hidden from AT, since everything
 * in the row is in the tab order.
 */
export function RailArrows({ edges, page, bar = false }: { edges: { start: boolean; end: boolean }; page: (direction: 1 | -1) => void; bar?: boolean }) {
  const pair = (
    <>
      <button type="button" tabIndex={-1} aria-hidden="true" onClick={() => page(-1)} data-hidden={!edges.start || undefined} className="tile-rail-arrow">
        <ChevronLeft aria-hidden="true" className="h-4 w-4 rtl:-scale-x-100" strokeWidth={2} />
      </button>
      <button type="button" tabIndex={-1} aria-hidden="true" onClick={() => page(1)} data-hidden={!edges.end || undefined} className="tile-rail-arrow">
        <ChevronRight aria-hidden="true" className="h-4 w-4 rtl:-scale-x-100" strokeWidth={2} />
      </button>
    </>
  )
  return bar ? <div className="tile-rail-bar">{pair}</div> : pair
}

// A card's slot from 1024px: every card keeps 232px and never grows, so two or three items never stretch into wide boxes.
// Below that a phone shows two cards and a sliver of the third (about 2.15 in view).
const FILL_SLOT = 'lg:grow-0 lg:basis-[232px]'
const COMPACT_SLOT = 'lg:grow-0 lg:basis-[232px]'

/** The heading row: its own member column on Home, or a plain row when the page's column already pads it (`nested`). */
function HeadRow({ nested, children }: { nested: boolean; children: ReactNode }) {
  const row = 'mb-1 flex items-center justify-between gap-2'
  return nested ? <div className={row}>{children}</div> : <MemberColumn wide className={row}>{children}</MemberColumn>
}

// One rail of the member home: a heading on the member column, then full perk
// cards in a row that reaches the screen's edges (.member-bleed) with its first
// card on the column's line; from 1024px it sits inside the page's fluid column and, unless `compact`,
// four cards fill it edge to edge (fewer grow to fill, up to half the row). A swipe settles on a card's start edge and the row
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
  showCategoryBadge = true,
  dots = false,
  autoAdvance = false,
  autoAdvanceOffsetMs = 0,
  compact = false,
  priorityCount = 0,
  nested = false,
  placeholders = 0,
}: {
  id: string
  title: string
  /** The heading's leading line icon (bare, 18px, 1.5 stroke). */
  glyph?: ReactNode
  offers: OfferDocument[]
  /** Both or neither: a category without a page has no link. */
  href?: string
  seeAll?: string
  /** Off in a rail already scoped to one category, where every card would repeat it. */
  showCategoryBadge?: boolean
  dots?: boolean
  /** Moves to the next card every 5 seconds (lib/useAutoAdvance.ts): Recommended, New and Best Sellers on Home. */
  autoAdvance?: boolean
  /** Staggers the rail from the others on the page. */
  autoAdvanceOffsetMs?: number
  /** Home's dense desktop rail: fixed 280px compact cards that never stretch. Off, the rail keeps its four-up fill. */
  compact?: boolean
  /** How many leading cards are above the fold (the page's first rail only): their photos load first, the rest stay lazy. */
  priorityCount?: number
  /** The rail already sits inside a padded MemberColumn (/categories): its heading and first card start on that column's line instead of adding a second gutter. */
  nested?: boolean
  /** Empty "Coming soon" slots after the offers (Home's category rows pad to 10): inert, so a published perk replaces one. */
  placeholders?: number
}) {
  const total = offers.length + placeholders
  const { ref: railRef, index: active, scrollTo } = useSnapIndex<HTMLDivElement>(total)
  const { edges, measure, page, overflowing } = useRailPaging(railRef, total)
  useAutoAdvance({ rowRef: railRef, count: total, active, scrollTo, enabled: autoAdvance, offsetMs: autoAdvanceOffsetMs })

  return (
    <section aria-labelledby={id}>
      <HeadRow nested={nested}>
        <h2 id={id} className="flex min-w-0 flex-1 items-center gap-1.5 text-xl font-bold tracking-tight text-ink">
          {/* A bare 18px line icon on the title's line: no badge, so the title keeps the width. */}
          {glyph && <span aria-hidden="true" className="flex shrink-0 items-center">{glyph}</span>}
          {/* One line, shrunk a little before it clips; a title that still can't fit wraps to a second line instead of cutting mid-word. */}
          <bdi className="line-clamp-2 min-w-0 text-balance leading-tight max-[420px]:text-[1.125rem]" dir="auto">{title}</bdi>
        </h2>
        {href && seeAll && (
          // Plain text and a chevron pointing the reading way: no pill, no border (44px target).
          <Link href={href} className="tap-target group/link inline-flex shrink-0 items-center gap-0.5 text-sm font-semibold text-brand focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand [@media(hover:hover)]:hover:underline">
            {seeAll}
            <ChevronRight aria-hidden="true" className="h-4 w-4 rtl:-scale-x-100" strokeWidth={2} />
          </Link>
        )}
        {overflowing && <RailArrows edges={edges} page={page} />}
      </HeadRow>
      <div className="offer-rail relative lg:mx-auto lg:max-w-[2200px]">
        <div
          ref={railRef}
          onScroll={measure}
          className={`${nested ? 'member-bleed-nested' : 'member-bleed member-bleed-fill'} edge-fade flex gap-2.5 overflow-x-auto touch-pan-x touch-pan-y touch-pinch-zoom overscroll-x-contain snap-x snap-mandatory scrollbar-none pb-3 pt-1 sm:gap-4`}
        >
          {offers.map((offer, index) => (
            <div key={offer.id} className={`flex shrink-0 snap-start lg:min-w-0 ${compact ? COMPACT_SLOT : FILL_SLOT}`}>
              <OfferCard offer={offer} showWishlistButton showCategoryBadge={showCategoryBadge} compact={compact} priority={index < priorityCount} className="lg:w-full" />
            </div>
          ))}
          {Array.from({ length: placeholders }, (_, i) => (
            <div key={`ph-${i}`} aria-hidden="true" className={`flex shrink-0 snap-start lg:min-w-0 ${compact ? COMPACT_SLOT : FILL_SLOT}`}>
              <OfferCardPlaceholder className="w-[clamp(150px,calc((100vw-36px)/2.15),232px)] flex-shrink-0 sm:w-[232px] lg:w-full" />
            </div>
          ))}
        </div>
      </div>
      {dots && placeholders === 0 && offers.length > 1 && offers.length <= SNAP_DOTS_MAX && <SnapDots count={offers.length} active={active} onSelect={scrollTo} className="-mt-2 sm:hidden" />}
    </section>
  )
}

'use client'

import { useRef, type ReactNode } from 'react'
import { MemberColumn } from '@/components/layout/MemberPageShell'
import { RailArrows } from '@/components/discover/OfferCardRail'
import { useRailPaging } from '@/lib/useRailPaging'
import { useLang } from '@/lib/i18n/useLang'
import type { OfferDocument } from '@/lib/firebase/offers'
import ChainTile from './ChainTile'

// One category's row on the Raayonit hub (native: landly-mobile/src/components/RaayonitCategoryRail.tsx): the heading with a "Show all" button
// on its own member column, then up to ten framed venue cards in a sideways snap row that reaches the screen's edges (.member-bleed).
// Same geometry as Home's perk rows; with a real mouse, arrows fade in on hover.
export default function RaayonitCategoryRail({ id, title, glyph, offers, hasMore, onShowAll, divider = false }: {
  id: string
  title: string
  glyph?: ReactNode
  offers: OfferDocument[]
  hasMore: boolean
  onShowAll: () => void
  /** A hairline above the row, separating it from the previous category. */
  divider?: boolean
}) {
  const { t } = useLang()
  const railRef = useRef<HTMLDivElement>(null)
  const { edges, measure, page, overflowing } = useRailPaging(railRef, offers.length)
  return (
    <section aria-labelledby={id} className="pb-6 sm:pb-8">
      {divider && <MemberColumn wide><div aria-hidden="true" className="mb-6 h-px bg-slate-200 sm:mb-8" /></MemberColumn>}
      <MemberColumn wide className="mb-1 flex items-center justify-between gap-2">
        <h3 id={id} className="flex min-w-0 flex-1 items-center gap-1.5 text-xl font-bold tracking-tight text-ink">
          {glyph && <span aria-hidden="true" className="flex shrink-0 items-center">{glyph}</span>}
          <bdi className="line-clamp-2 min-w-0 text-balance leading-tight max-[420px]:text-[1.125rem]" dir="auto">{title}</bdi>
        </h3>
        {hasMore && (
          <button type="button" onClick={onShowAll} aria-haspopup="dialog" aria-label={`${t('filter_show_all')}: ${title}`}
            className="tap-target inline-flex shrink-0 items-center text-sm font-semibold text-brand focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand [@media(hover:hover)]:hover:underline">
            {t('filter_show_all')}
          </button>
        )}
        {overflowing && <div className="flex shrink-0 items-center gap-2"><RailArrows edges={edges} page={page} /></div>}
      </MemberColumn>
      <div className="offer-rail relative lg:mx-auto lg:max-w-[2200px]">
        <div ref={railRef} onScroll={measure}
          className="member-bleed member-bleed-fill edge-fade flex gap-2.5 overflow-x-auto touch-pan-x touch-pan-y touch-pinch-zoom overscroll-x-contain snap-x snap-mandatory scroll-smooth pb-3 pt-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {offers.map((o) => (
            <div key={o.id} className="flex w-[clamp(150px,calc((100vw-36px)/2.15),232px)] shrink-0 snap-start sm:w-[232px]">
              <div className="w-full"><ChainTile offer={o} /></div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

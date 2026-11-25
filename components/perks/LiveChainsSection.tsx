'use client'

import { useRef, type ReactNode } from 'react'
import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import { MemberColumn } from '@/components/layout/MemberPageShell'
import { RailArrows } from '@/components/discover/OfferCardRail'
import LiveChainTile from '@/components/perks/LiveChainTile'
import type { OfferDocument } from '@/lib/firebase/offers'
import { liveChainCount } from '@/lib/home/chainsPreview'
import { useLang } from '@/lib/i18n/useLang'
import { RAAYONIT_HUB } from '@/lib/offers/offerRoutes'
import { useRailPaging } from '@/lib/useRailPaging'

// "Available now" with a live dot on Home and Explore Perks while GoLandly has no direct perks of its own (native:
// landly-mobile/src/components/LiveChainsSection.tsx): one section header with its "See all" link and a sideways row of the businesses that
// accept the Raayonit Card today. `chainCount` is the real number of chains: the header shows no number until it is known, and the section is
// absent without chains. The entry (Home's carousel, Explore's row) is its own block above. Same geometry as the rails: the heading on the member
// column (or a plain block when the page's column already pads it: `nested`), the cards in a snap row that reaches the screen's edges.
const TILE = 'flex w-[168px] shrink-0 snap-start sm:w-[176px] xl:w-[184px] 2xl:w-[200px] min-[1920px]:w-[216px]'

function Block({ nested, children }: { nested: boolean; children: ReactNode }) {
  return nested ? <div>{children}</div> : <MemberColumn wide>{children}</MemberColumn>
}

export default function LiveChainsSection({ offers, chainCount, className = '', nested = false }: { offers: OfferDocument[]; chainCount: number; className?: string; nested?: boolean }) {
  const { t } = useLang()
  const railRef = useRef<HTMLDivElement>(null)
  const { edges, measure, page, overflowing } = useRailPaging(railRef, offers.length)
  const count = liveChainCount(chainCount)
  if (count === null || offers.length === 0) return null
  return (
    <section aria-labelledby="live-chains-title" className={className}>
      <Block nested={nested}>
        <div className="flex items-center justify-between gap-3">
          <h2 id="live-chains-title" className="flex min-w-0 flex-1 items-center gap-2 truncate text-lg font-bold leading-tight tracking-tight text-ink sm:text-xl">
            <span aria-hidden="true" className="live-dot" />
            {t('perks_available_now')}
          </h2>
          {overflowing && <div className="hidden shrink-0 items-center gap-2 sm:flex"><RailArrows edges={edges} page={page} /></div>}
          <Link href={RAAYONIT_HUB} className="group inline-flex min-h-11 shrink-0 items-center gap-0.5 text-sm font-semibold text-brand focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand">
            {t('see_all')}
            <ChevronRight aria-hidden="true" className="h-4 w-4 transition-transform duration-300 rtl:-scale-x-100 [@media(hover:hover)]:group-hover:translate-x-0.5 rtl:[@media(hover:hover)]:group-hover:-translate-x-0.5" strokeWidth={2} />
          </Link>
        </div>
      </Block>
      <div className="offer-rail relative mt-1 lg:mx-auto lg:max-w-[2200px]">
        <div ref={railRef} onScroll={measure}
          className={`${nested ? 'member-bleed-nested' : 'member-bleed member-bleed-fill'} edge-fade flex gap-2.5 overflow-x-auto touch-pan-x touch-pan-y touch-pinch-zoom overscroll-x-contain snap-x snap-mandatory scroll-smooth pb-3 pt-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden`}>
          {offers.map((o) => <div key={o.id} className={TILE}><LiveChainTile offer={o} /></div>)}
        </div>
      </div>
    </section>
  )
}

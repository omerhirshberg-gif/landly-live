'use client'

import { useRef, type ReactNode } from 'react'
import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import { MemberColumn } from '@/components/layout/MemberPageShell'
import { RailArrows } from '@/components/discover/OfferCardRail'
import LiveChainTile from '@/components/perks/LiveChainTile'
import RaayonitBanner from '@/components/perks/RaayonitBanner'
import type { OfferDocument } from '@/lib/firebase/offers'
import { liveChainCount } from '@/lib/home/chainsPreview'
import { useLang } from '@/lib/i18n/useLang'
import { RAAYONIT_HUB } from '@/lib/offers/offerRoutes'
import { useRailPaging } from '@/lib/useRailPaging'

// "Redeemable today at {count}+ chains and businesses" on Home and Explore Perks while GoLandly has no direct perks of its own (native:
// landly-mobile/src/components/LiveChainsSection.tsx): the live count, one line, a primary action to the Raayonit Card tab and a sideways row of
// participating chains ending in "See all chains". `chainCount` is the real number of chains: the heading shows no number until it is known, and the
// section is absent without chains. It only reads the tab's data; nothing of the tab is restyled. Same geometry as the rails: the heading on the
// member column (or a plain block when the page's column already pads it: `nested`), the cards in a snap row that reaches the screen's edges.
const TILE = 'flex w-[168px] shrink-0 snap-start sm:w-[176px] xl:w-[184px] 2xl:w-[200px] min-[1920px]:w-[216px]'

function Block({ nested, children }: { nested: boolean; children: ReactNode }) {
  return nested ? <div>{children}</div> : <MemberColumn wide>{children}</MemberColumn>
}

export default function LiveChainsSection({ offers, chainCount, className = '', nested = false, card = false }: { offers: OfferDocument[]; chainCount: number; className?: string; nested?: boolean; card?: boolean }) {
  const { t } = useLang()
  const railRef = useRef<HTMLDivElement>(null)
  const { edges, measure, page, overflowing } = useRailPaging(railRef, offers.length + 1)
  const count = liveChainCount(chainCount)
  if (count === null || offers.length === 0) return null
  // The count is set LTR inside the sentence ("230+" stays whole in Hebrew).
  const [before, after] = t('chains_live_title').split('{count}')
  return (
    <section aria-labelledby="live-chains-title" className={className}>
      <Block nested={nested}>
        <div className="flex items-start justify-between gap-3">
          <h2 id="live-chains-title" className="min-w-0 flex-1 text-xl font-extrabold leading-tight tracking-tight text-ink text-balance sm:text-2xl">
            {before}<bdi dir="ltr">{count}+</bdi>{after}
          </h2>
          {overflowing && <div className="hidden shrink-0 items-center gap-2 sm:flex"><RailArrows edges={edges} page={page} /></div>}
        </div>
        <p className="mt-1 max-w-2xl text-sm leading-5 text-body">{t('chains_live_sub')}</p>
        {card ? <RaayonitBanner /> : (
        <Link href={RAAYONIT_HUB} className="group mt-3.5 inline-flex min-h-11 items-center gap-1.5 rounded-full bg-brand px-5 text-sm font-bold text-white shadow-[0_8px_30px_rgb(0,56,184,0.18)] transition-all duration-300 hover:bg-brand-dark focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand motion-reduce:transition-none [@media(hover:hover)]:hover:-translate-y-0.5 motion-reduce:[@media(hover:hover)]:hover:translate-y-0">
          {t('chains_live_cta')}
          <ChevronRight aria-hidden="true" className="h-4 w-4 rtl:-scale-x-100" strokeWidth={2} />
        </Link>
        )}
      </Block>
      <div className="offer-rail relative mt-4 lg:mx-auto lg:max-w-[2200px]">
        <div ref={railRef} onScroll={measure}
          className={`${nested ? 'member-bleed-nested' : 'member-bleed member-bleed-fill'} edge-fade flex gap-2.5 overflow-x-auto touch-pan-x touch-pan-y touch-pinch-zoom overscroll-x-contain snap-x snap-mandatory scroll-smooth pb-3 pt-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden`}>
          {offers.map((o) => <div key={o.id} className={TILE}><LiveChainTile offer={o} /></div>)}
          <div className={TILE}>
            <Link href={RAAYONIT_HUB} className="flex w-full flex-col items-center justify-center gap-1 rounded-2xl border border-slate-200/80 bg-blue-50/60 px-3 text-center text-sm font-bold text-brand transition-all duration-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand [@media(hover:hover)]:hover:-translate-y-0.5">
              {t('chains_live_show_all')}
              <ChevronRight aria-hidden="true" className="h-4 w-4 rtl:-scale-x-100" strokeWidth={2} />
            </Link>
          </div>
        </div>
      </div>
    </section>
  )
}

'use client'

import { useMemo, useRef } from 'react'
import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import { RailArrows } from '@/components/discover/OfferCardRail'
import ChainTile from '@/components/raayonit/ChainTile'
import type { OfferDocument } from '@/lib/firebase/offers'
import { isolateLtr } from '@/lib/home/superShowcase'
import { useLang } from '@/lib/i18n/useLang'
import { chainsByCategory } from '@/lib/offers/discoverTab'
import { RAAYONIT_HUB } from '@/lib/offers/offerRoutes'
import { roundedCount } from '@/lib/offers/raayonitPreview'
import { useRailPaging } from '@/lib/useRailPaging'

const MAX_TILES = 24

// "Businesses that accept it" for the guest landing: the same framed venue cards as the Raayonit card page, as one sideways snap
// row that runs to both edges of the box around it (the parent's padding, -mx-4 / sm:-mx-8), with step arrows for a mouse.
export default function GuestChainRail({ chains }: { chains: OfferDocument[] }) {
  const { t, lang } = useLang()
  const railRef = useRef<HTMLDivElement>(null)
  // One venue from each category in turn, so the row mixes restaurants, hotels, shops and attractions instead of running through one category first.
  const list = useMemo(() => {
    const groups = chainsByCategory(chains, lang).map((g) => g.offers)
    const mixed: OfferDocument[] = []
    for (let i = 0; mixed.length < MAX_TILES && groups.some((g) => i < g.length); i++) {
      for (const g of groups) if (i < g.length && mixed.length < MAX_TILES) mixed.push(g[i])
    }
    return mixed
  }, [chains, lang])
  const { edges, measure, page, overflowing } = useRailPaging(railRef, list.length)
  if (list.length < 4) return null
  return (
    <section aria-labelledby="guest-chain-rail-title" className="mt-8">
      <div className="flex items-center justify-between gap-3">
        <h2 id="guest-chain-rail-title" className="min-w-0 text-lg font-extrabold tracking-tight text-ink sm:text-xl">{t('raayonit_accepting_title')}</h2>
        <div className="flex shrink-0 items-center gap-2">
          <Link href={RAAYONIT_HUB} className="flex min-h-11 items-center gap-0.5 rounded-lg px-1 text-sm font-semibold text-brand focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand">
            <span>{t('businesses_see_all').replace('{count}+', isolateLtr(`${roundedCount(chains.length)}+`))}</span>
            <ChevronRight aria-hidden="true" className="h-4 w-4 rtl:-scale-x-100" strokeWidth={2} />
          </Link>
          {overflowing && <div className="flex items-center gap-2"><RailArrows edges={edges} page={page} /></div>}
        </div>
      </div>
      <div ref={railRef} onScroll={measure} className="-mx-4 mt-2 flex snap-x snap-mandatory gap-2.5 overflow-x-auto scroll-smooth px-4 pb-3 pt-1 [scrollbar-width:none] sm:-mx-8 sm:px-8 [&::-webkit-scrollbar]:hidden">
        {list.map((o) => (
          <div key={o.id} className="flex w-[clamp(180px,calc((100vw-72px)/2.15),232px)] shrink-0 snap-start sm:w-[232px]">
            <div className="w-full"><ChainTile offer={o} /></div>
          </div>
        ))}
      </div>
    </section>
  )
}

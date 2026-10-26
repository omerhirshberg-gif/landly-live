'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import OfferCard from '@/components/discover/OfferCard'
import SnapDots, { SNAP_DOTS_MAX } from '@/components/ui/SnapDots'
import { getAllOffers, sortFeaturedOffers, type OfferDocument } from '@/lib/firebase/offers'
import { useLang } from '@/lib/i18n/useLang'
import { useSnapIndex } from '@/lib/useSnapIndex'

const CURATED_COUNT = 8

// "Curated for you" on the members' home: the featured offers in a horizontal
// rail, with "See all" into /categories. Guests get PerkExamples instead.
export default function CuratedOffers({ showWishlistButton = false }: { showWishlistButton?: boolean }) {
  const { t } = useLang()
  const [offers, setOffers] = useState<OfferDocument[] | null>(null)
  const { ref: railRef, index: active, scrollTo } = useSnapIndex<HTMLDivElement>(offers?.length ?? 0)

  useEffect(() => {
    let cancelled = false
    getAllOffers()
      .then((all) => {
        if (!cancelled) setOffers(sortFeaturedOffers(all).slice(0, CURATED_COUNT))
      })
      .catch(() => {
        if (!cancelled) setOffers([])
      })
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <section aria-labelledby="home-curated-title">
      <div className="flex items-center justify-between gap-3 mb-4">
        <h2 id="home-curated-title" className="min-w-0 text-xl font-bold text-ink">{t('home_curated_title')}</h2>
        <Link href="/categories" className="tap-target inline-flex shrink-0 items-center text-sm font-semibold text-brand hover:underline">
          {t('home_see_all')}
        </Link>
      </div>
      {offers === null ? (
        <div className="flex gap-3 overflow-hidden sm:gap-4" aria-hidden="true">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="flex-shrink-0 w-[clamp(240px,72vw,260px)] h-[260px] rounded-2xl bg-white border border-line animate-pulse" />
          ))}
        </div>
      ) : offers.length === 0 ? (
        <div className="bg-white border border-line rounded-2xl p-6 text-center">
          <p className="font-bold text-ink mb-1">{t('deals_empty_title')}</p>
          <p className="text-sm text-body">{t('deals_empty_sub')}</p>
        </div>
      ) : (
        // Compact rail cards, about 72vw wide, so the next one peeks in; a swipe
        // settles on a card's start edge, and the row never drags the page sideways.
        // On phones, pagination dots underneath show where in the row you are.
        <>
          <div ref={railRef} className="edge-fade -mx-4 px-4 scroll-px-4 sm:mx-0 sm:px-0 sm:scroll-px-0 flex gap-3 sm:gap-4 overflow-x-auto overscroll-x-contain pb-2 snap-x snap-mandatory [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {offers.map((offer) => (
              <div key={offer.id} className="flex shrink-0 snap-start">
                <OfferCard offer={offer} showWishlistButton={showWishlistButton} />
              </div>
            ))}
          </div>
          {offers.length > 1 && offers.length <= SNAP_DOTS_MAX && <SnapDots count={offers.length} active={active} onSelect={scrollTo} className="-mt-1 sm:hidden" />}
        </>
      )}
    </section>
  )
}

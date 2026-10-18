'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { getAllOffers, sortFeaturedOffers, type OfferDocument } from '@/lib/firebase/offers'
import { useLang } from '@/lib/i18n/useLang'
import PerkExampleCard from './PerkExampleCard'

const EXAMPLE_COUNT = 8
// Desktop shows one row of four; phones swipe through all of them.
const DESKTOP_COUNT = 4

// The guest home's "Real examples of perks", right under What's inside
// (ValueProps), on the page's shared gradient: the featured offers as a
// swipeable rail on phones and a four-column row from lg, "All perks" into
// /categories. Offers are public, so any card opens.
export default function PerkExamples() {
  const { t } = useLang()
  const [offers, setOffers] = useState<OfferDocument[] | null>(null)

  useEffect(() => {
    let cancelled = false
    getAllOffers()
      .then((all) => {
        if (!cancelled) setOffers(sortFeaturedOffers(all).slice(0, EXAMPLE_COUNT))
      })
      .catch(() => {
        if (!cancelled) setOffers([])
      })
    return () => {
      cancelled = true
    }
  }, [])

  // Nothing to show (no offers yet, or the read failed): the section steps aside.
  if (offers?.length === 0) return null

  const item = (i: number) => `flex shrink-0 snap-start w-[clamp(240px,72vw,260px)] lg:w-auto ${i >= DESKTOP_COUNT ? 'lg:hidden' : ''}`

  return (
    <section aria-labelledby="home-examples-title" className="py-12 sm:py-14 lg:py-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex items-start justify-between gap-4 mb-5 sm:mb-6">
          <div className="min-w-0">
            <h2 id="home-examples-title" className="text-2xl sm:text-3xl font-black text-[#0B1B3D] mb-1.5" style={{ letterSpacing: '-0.02em' }}>
              {t('home_examples_title')}
            </h2>
            <p className="text-[#475569] text-[15px] leading-relaxed">{t('home_examples_sub')}</p>
          </div>
          <Link
            href="/categories"
            className="tap-target flex-shrink-0 inline-flex items-center gap-1.5 text-sm font-bold text-brand hover:underline whitespace-nowrap"
          >
            <span>{t('home_examples_all')}</span>
            <i className="fa-solid fa-arrow-right text-xs rtl:-scale-x-100" aria-hidden="true"></i>
          </Link>
        </div>

        {/* A swipe rail on phones and tablets (the next card peeks in, a swipe
            settles on a card's start edge, the page never drags sideways); a
            plain four-column grid from lg. */}
        <ul className="edge-fade -mx-4 px-4 scroll-px-4 sm:mx-0 sm:px-0 sm:scroll-px-0 flex gap-3 sm:gap-4 overflow-x-auto overscroll-x-contain pb-2 snap-x snap-mandatory [scrollbar-width:none] [&::-webkit-scrollbar]:hidden lg:grid lg:grid-cols-4 lg:overflow-visible lg:pb-0">
          {offers === null
            ? Array.from({ length: DESKTOP_COUNT }, (_, i) => (
                <li key={i} aria-hidden="true" className={item(i)}>
                  <div className="h-[236px] w-full rounded-2xl border border-[#E2E8F0] bg-white animate-pulse motion-reduce:animate-none" />
                </li>
              ))
            : offers.map((offer, i) => (
                <li key={offer.id} className={item(i)}>
                  <PerkExampleCard offer={offer} />
                </li>
              ))}
        </ul>
      </div>
    </section>
  )
}

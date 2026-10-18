'use client'

import { ReactNode, useEffect, useState } from 'react'
import Link from 'next/link'
import { useLang } from '@/lib/i18n/useLang'
import OfferCard from '@/components/discover/OfferCard'
import type { OfferDocument } from '@/lib/firebase/offers'
import { perksCountLabel } from '@/lib/categories'

interface Props {
  emoji: string
  title: string
  // Identifies which listing this is (category name, 'new', 'bestsellers') so the
  // effect only refetches when the listing actually changes — not on every
  // render, since fetchOffers is a fresh closure each time.
  depKey: string
  fetchOffers: () => Promise<OfferDocument[]>
  // Optional toolbar (filter/sort/search controls) rendered above the grid —
  // currently unused (/new and /bestsellers pass none).
  controls?: ReactNode
  // Optional client-side transform (search filter + sort) applied to the
  // fetched list before it's rendered — runs ahead of the loading/empty/grid
  // branching so the empty state still shows correctly for "no matches".
  filterOffers?: (offers: OfferDocument[]) => OfferDocument[]
}

// A category "folder" (and the New / Best Sellers lists): a back link to the
// grid, the emoji and title with the perk count, then the offers. It enters
// with a short slide from the reading direction (.folder-in). Vertical panning
// only on the list, so the browser's own edge swipe-back is never contested.
export default function OfferListView({ emoji, title, depKey, fetchOffers, controls, filterOffers }: Props) {
  const { t } = useLang()
  const [offers, setOffers] = useState<OfferDocument[] | undefined>(undefined)

  useEffect(() => {
    let cancelled = false
    setOffers(undefined)
    fetchOffers().then((result) => {
      if (!cancelled) setOffers(result)
    })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [depKey])

  const visibleOffers = offers && filterOffers ? filterOffers(offers) : offers

  return (
    <div className="folder-in max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
      <Link
        href="/categories"
        className="tap-target -ms-2 inline-flex items-center gap-1 rounded-full pe-3 ps-2 text-sm font-semibold text-brand transition-colors hover:bg-brandLight mb-4"
      >
        <i aria-hidden="true" className="fa-solid fa-chevron-left text-xs rtl:-scale-x-100"></i>
        <span>{t('cats_detail_back')}</span>
      </Link>

      <div className="flex items-center gap-3 sm:gap-4 mb-8">
        <span aria-hidden="true" className="flex h-14 w-14 sm:h-16 sm:w-16 flex-shrink-0 items-center justify-center rounded-2xl border border-slate-100 bg-white text-[32px] sm:text-4xl leading-none">
          {emoji}
        </span>
        <div className="min-w-0">
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 leading-tight break-words">{title}</h1>
          {offers === undefined ? (
            <span aria-hidden="true" className="mt-2 block h-3.5 w-28 rounded-full bg-slate-100 animate-pulse motion-reduce:animate-none" />
          ) : (
            <p className="mt-1 text-sm text-slate-500">{perksCountLabel(offers.length, t)}</p>
          )}
        </div>
      </div>

      {controls && <div className="mb-6">{controls}</div>}

      {visibleOffers === undefined ? (
        <div className="dash-empty-state">
          <i className="fa-solid fa-spinner fa-spin" aria-hidden="true"></i>
        </div>
      ) : visibleOffers.length === 0 ? (
        <div className="dash-empty-state bg-white border border-slate-100 rounded-2xl">
          <i className="fa-solid fa-tags" aria-hidden="true"></i>
          <div className="font-bold text-slate-700 text-base mb-1">{t('deals_empty_title')}</div>
          <p className="text-sm text-slate-500 max-w-xs">{t('deals_empty_sub')}</p>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2.5 sm:gap-3 touch-pan-y touch-pinch-zoom">
          {visibleOffers.map((offer) => (
            <OfferCard key={offer.id} offer={offer} />
          ))}
        </div>
      )}
    </div>
  )
}

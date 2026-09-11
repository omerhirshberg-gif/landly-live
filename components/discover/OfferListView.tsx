'use client'

import { ReactNode, useEffect, useState } from 'react'
import Link from 'next/link'
import { useLang } from '@/lib/i18n/useLang'
import OfferCard from '@/components/discover/OfferCard'
import type { OfferDocument } from '@/lib/firebase/offers'

interface Props {
  emoji: string
  title: string
  // Identifies which listing this is (category name, 'new', 'bestsellers') so the
  // effect only refetches when the listing actually changes — not on every
  // render, since fetchOffers is a fresh closure each time.
  depKey: string
  fetchOffers: () => Promise<OfferDocument[]>
  // Optional toolbar (filter/sort/search controls) rendered above the grid —
  // unused by /new and /bestsellers, used by /categories/[category].
  controls?: ReactNode
  // Optional client-side transform (search filter + sort) applied to the
  // fetched list before it's rendered — runs ahead of the loading/empty/grid
  // branching so the empty state still shows correctly for "no matches".
  filterOffers?: (offers: OfferDocument[]) => OfferDocument[]
}

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
    <div className="max-w-7xl mx-auto px-5 sm:px-6 py-8 sm:py-10">
      <Link
        href="/categories"
        className="tap-target inline-flex items-center gap-2 text-sm font-bold text-brand bg-brand/10 border border-brand/20 rounded-full px-4 py-2 transition hover:bg-brand/20 hover:border-brand/40 mb-5"
      >
        <i className="fa-solid fa-arrow-left text-xs"></i>
        <span>{t('cats_detail_back')}</span>
      </Link>

      <div className="flex items-center gap-3 mb-8">
        <span className="text-3xl sm:text-4xl">{emoji}</span>
        <h1 className="text-2xl sm:text-3xl font-black text-slate-900">{title}</h1>
      </div>

      {controls && <div className="mb-6">{controls}</div>}

      {visibleOffers === undefined ? (
        <div className="dash-empty-state">
          <i className="fa-solid fa-spinner fa-spin"></i>
        </div>
      ) : visibleOffers.length === 0 ? (
        <div className="dash-empty-state bg-white border border-slate-100 rounded-2xl">
          <i className="fa-solid fa-tags"></i>
          <div className="font-bold text-slate-700 text-base mb-1">{t('deals_empty_title')}</div>
          <p className="text-sm text-slate-500 max-w-xs">{t('deals_empty_sub')}</p>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2.5 sm:gap-3">
          {visibleOffers.map((offer) => (
            <OfferCard key={offer.id} offer={offer} />
          ))}
        </div>
      )}
    </div>
  )
}

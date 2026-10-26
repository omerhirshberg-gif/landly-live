'use client'

import { ReactNode, useEffect, useState } from 'react'
import BackButton from '@/components/navigation/BackButton'
import { LoaderCircle, Tags, type LucideIcon } from 'lucide-react'
import IconFrame from '@/components/ui/IconFrame'
import { useLang } from '@/lib/i18n/useLang'
import OfferCard, { OFFER_FEED_GRID } from '@/components/discover/OfferCard'
import type { OfferDocument } from '@/lib/firebase/offers'
import { perksCountLabel } from '@/lib/categories'

interface Props {
  /** The heading's Lucide glyph, e.g. Award for Bestsellers. */
  icon: LucideIcon
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
// grid, the icon and title with the perk count, then the offers. It enters
// with a short slide from the reading direction (.folder-in). Vertical panning
// only on the list, so the browser's own edge swipe-back is never contested.
export default function OfferListView({ icon, title, depKey, fetchOffers, controls, filterOffers }: Props) {
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
      <BackButton fallback="/categories" label={t('cats_detail_back')} className="mb-4" />

      <div className="flex items-center gap-3 sm:gap-4 mb-8">
        <IconFrame icon={icon} size="sm" />
        <div className="min-w-0">
          <h1 className="text-page sm:text-page-lg lg:text-3xl font-bold text-ink leading-tight break-words">{title}</h1>
          {offers === undefined ? (
            <span aria-hidden="true" className="mt-2 block h-3.5 w-28 rounded-full bg-slate-100 animate-pulse motion-reduce:animate-none" />
          ) : (
            <p className="mt-1 text-sm text-body">{perksCountLabel(offers.length, t)}</p>
          )}
        </div>
      </div>

      {controls && <div className="mb-6">{controls}</div>}

      {visibleOffers === undefined ? (
        <div className="dash-empty-state">
          <LoaderCircle aria-hidden="true" className="animate-spin motion-reduce:animate-none" strokeWidth={1.75} />
        </div>
      ) : visibleOffers.length === 0 ? (
        <div className="dash-empty-state bg-white border border-slate-100 rounded-2xl">
          <Tags aria-hidden="true" strokeWidth={1.75} />
          <div className="font-bold text-ink text-base mb-1">{t('deals_empty_title')}</div>
          <p className="text-sm text-body max-w-xs">{t('deals_empty_sub')}</p>
        </div>
      ) : (
        <div className={`${OFFER_FEED_GRID} touch-pan-y touch-pinch-zoom`}>
          {visibleOffers.map((offer) => (
            <OfferCard key={offer.id} offer={offer} layout="grid" />
          ))}
        </div>
      )}
    </div>
  )
}

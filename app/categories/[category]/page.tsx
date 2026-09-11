'use client'

import { FormEvent, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Navbar from '@/components/layout/Navbar'
import NearMeButton from '@/components/discover/NearMeButton'
import OfferListView from '@/components/discover/OfferListView'
import { useLang } from '@/lib/i18n/useLang'
import { CATEGORY_TILES } from '@/lib/categories'
import { getOffersByCategory, offerMatchesQuery, OfferDocument } from '@/lib/firebase/offers'
import type { Coordinates } from '@/lib/geo'

type SortBy = 'default' | 'newest' | 'price-asc' | 'price-desc'

export default function CategoryPage() {
  const { t, isRtl } = useLang()
  const router = useRouter()
  const { category: rawCategory } = useParams<{ category: string }>()
  const category = decodeURIComponent(rawCategory)
  const tile = CATEGORY_TILES.find((c) => c.category === category)

  // Draft reflects what's in the search box right now; applied is what actually
  // filters, and only changes on explicit submit (Search button / Enter) — same
  // pattern as /categories. Clearing stays instant.
  const [query, setQuery] = useState('')
  const [appliedQuery, setAppliedQuery] = useState('')
  const [sortBy, setSortBy] = useState<SortBy>('default')
  // Captured but not yet applied to the offer list — offers only carry a
  // display-string `location`, not coordinates, so there's nothing to sort by
  // distance against until businesses get real geo data (Google Places, deferred).
  const [, setUserLocation] = useState<Coordinates | null>(null)

  const handleSearchSubmit = (e: FormEvent) => {
    e.preventDefault()
    setAppliedQuery(query)
  }

  const handleClearSearch = () => {
    setQuery('')
    setAppliedQuery('')
  }

  const filterOffers = (offers: OfferDocument[]): OfferDocument[] => {
    const normalizedQuery = appliedQuery.trim().toLowerCase()
    const matched = normalizedQuery ? offers.filter((offer) => offerMatchesQuery(offer, normalizedQuery)) : offers

    switch (sortBy) {
      case 'newest':
        return [...matched].sort((a, b) => (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0))
      case 'price-asc':
        return [...matched].sort((a, b) => a.offerPrice - b.offerPrice)
      case 'price-desc':
        return [...matched].sort((a, b) => b.offerPrice - a.offerPrice)
      default:
        return matched
    }
  }

  const controls = (
    <form onSubmit={handleSearchSubmit} className="flex flex-col sm:flex-row sm:items-center gap-3">
      <div className="relative flex-1">
        <i className={`fa-solid fa-magnifying-glass absolute top-1/2 -translate-y-1/2 text-slate-400 text-sm pointer-events-none ${isRtl ? 'left-4' : 'right-4'}`}></i>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t('cats_search_placeholder')}
          className="inp !pl-11 !pr-11"
        />
        {query && (
          <button
            type="button"
            onClick={handleClearSearch}
            aria-label="Clear search"
            className={`tap-target absolute top-1/2 -translate-y-1/2 flex items-center justify-center w-8 h-8 text-slate-400 hover:text-slate-600 ${isRtl ? 'right-2' : 'left-2'}`}
          >
            <i className="fa-solid fa-xmark text-sm"></i>
          </button>
        )}
      </div>

      <button
        type="submit"
        className="tap-target bg-brand text-white font-bold text-sm px-6 py-2.5 rounded-full hover:opacity-90 transition sm:w-auto"
      >
        {t('cats_search_button')}
      </button>

      <select
        value={category}
        onChange={(e) => router.push(`/categories/${encodeURIComponent(e.target.value)}`)}
        aria-label={t('cats_category_label')}
        className="inp sm:w-auto"
      >
        {CATEGORY_TILES.map((c) => (
          <option key={c.category} value={c.category}>
            {t(c.labelKey)}
          </option>
        ))}
      </select>

      <select
        value={sortBy}
        onChange={(e) => setSortBy(e.target.value as SortBy)}
        aria-label={t('cats_sort_label')}
        className="inp sm:w-auto"
      >
        <option value="default">{t('cats_sort_default')}</option>
        <option value="newest">{t('cats_sort_newest')}</option>
        <option value="price-asc">{t('cats_sort_price_asc')}</option>
        <option value="price-desc">{t('cats_sort_price_desc')}</option>
      </select>

      <NearMeButton onLocate={setUserLocation} />
    </form>
  )

  return (
    <>
      <Navbar />
      <div className="pt-16">
        <OfferListView
          emoji={tile?.emoji ?? ''}
          title={tile ? t(tile.labelKey) : category}
          depKey={category}
          fetchOffers={() => getOffersByCategory(category)}
          controls={controls}
          filterOffers={filterOffers}
        />
      </div>
    </>
  )
}

'use client'

import { FormEvent, useEffect, useState } from 'react'
import Link from 'next/link'
import Navbar from '@/components/layout/Navbar'
import NearMeButton from '@/components/discover/NearMeButton'
import OfferCard from '@/components/discover/OfferCard'
import { useLang } from '@/lib/i18n/useLang'
import { TranslationKey } from '@/lib/i18n/translations'
import { sortByDistance, reverseGeocode, Coordinates } from '@/lib/geo'
import type { Business } from '@/lib/types/business'
import { CATEGORY_TILES } from '@/lib/categories'
import { getAllOffers, getBestsellerOffers, isOfferNew, offerMatchesQuery, OfferDocument } from '@/lib/firebase/offers'

// No businesses onboarded yet — populated once real listings exist.
const BUSINESSES: Business[] = []

type Tile = { emoji: string; labelKey: TranslationKey; newDot?: boolean; category?: string; href?: string }

function CompactTile({ tile, t }: { tile: Tile; t: (key: TranslationKey) => string }) {
  const content = (
    <>
      <span>{tile.emoji}</span>
      <span>{t(tile.labelKey)}</span>
      {tile.newDot && <span className="new-badge-dot"></span>}
    </>
  )
  const className =
    'inline-flex items-center gap-2 flex-shrink-0 bg-white border border-slate-100 rounded-full px-4 py-2.5 text-sm font-bold text-slate-700 hover:border-brand hover:text-brand transition whitespace-nowrap'
  const href = tile.href ?? (tile.category ? `/categories/${encodeURIComponent(tile.category)}` : undefined)
  return href ? (
    <Link href={href} className={className}>
      {content}
    </Link>
  ) : (
    <div className={className}>{content}</div>
  )
}

const TILES: Tile[] = [
  { emoji: '✨', labelKey: 'row_new', newDot: true, href: '/categories/new' },
  { emoji: '🔥', labelKey: 'row_bestsellers', href: '/categories/bestsellers' },
  ...CATEGORY_TILES,
]

export default function CategoriesPage() {
  const { t, isRtl } = useLang()
  const [userLocation, setUserLocation] = useState<Coordinates | null>(null)
  const [placeName, setPlaceName] = useState<string | null>(null)
  // Draft values reflect what's in the controls right now; "applied" values are
  // what actually drive the results view, and only change on explicit submit
  // (Search button / Enter) — except clearing, which resets both immediately.
  const [query, setQuery] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [appliedQuery, setAppliedQuery] = useState('')
  const [appliedCategoryFilter, setAppliedCategoryFilter] = useState('')
  const [offers, setOffers] = useState<OfferDocument[] | undefined>(undefined)
  const [bestsellerOffers, setBestsellerOffers] = useState<OfferDocument[] | undefined>(undefined)

  const nearby = userLocation ? sortByDistance(BUSINESSES, userLocation) : null

  useEffect(() => {
    getAllOffers().then(setOffers)
    getBestsellerOffers().then(setBestsellerOffers)
  }, [])

  const handleSearchSubmit = (e: FormEvent) => {
    e.preventDefault()
    setAppliedQuery(query)
    setAppliedCategoryFilter(categoryFilter)
  }

  const handleClearSearch = () => {
    setQuery('')
    setAppliedQuery('')
  }

  const handleCategoryChange = (value: string) => {
    setCategoryFilter(value)
    if (value === '') setAppliedCategoryFilter('') // clearing back to "All Categories" resets instantly
  }

  const normalizedQuery = appliedQuery.trim().toLowerCase()
  const isSearching = normalizedQuery.length > 0
  const isCategoryFiltering = appliedCategoryFilter !== ''
  const isFiltering = isSearching || isCategoryFiltering

  const filteredResults = isFiltering
    ? (offers ?? []).filter(
        (offer) =>
          (!isCategoryFiltering || offer.category === appliedCategoryFilter) &&
          (!isSearching || offerMatchesQuery(offer, normalizedQuery))
      )
    : []
  const categoryFilterLabel = CATEGORY_TILES.find((c) => c.category === appliedCategoryFilter)?.labelKey

  const newOffers = offers?.filter((offer) => isOfferNew(offer.createdAt)) ?? []

  const offersByCategory = offers
    ? offers.reduce<Map<string, OfferDocument[]>>((groups, offer) => {
        const group = groups.get(offer.category) ?? []
        group.push(offer)
        groups.set(offer.category, group)
        return groups
      }, new Map())
    : null

  useEffect(() => {
    if (!userLocation) {
      setPlaceName(null)
      return
    }
    let cancelled = false
    reverseGeocode(userLocation).then((place) => {
      if (cancelled) return
      setPlaceName(place ? [place.city, place.state].filter(Boolean).join(', ') : null)
    })
    return () => { cancelled = true }
  }, [userLocation])
  const nearbyByCategory = nearby
    ? nearby.reduce<Map<string, Business[]>>((groups, business) => {
        const group = groups.get(business.category) ?? []
        group.push(business)
        groups.set(business.category, group)
        return groups
      }, new Map())
    : null

  return (
    <>
      <Navbar />
      <div className="pt-16">
        <div className="max-w-7xl mx-auto px-5 sm:px-6 py-8 sm:py-10">
          <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900">{t('cats_page_title')}</h1>
            <NearMeButton onLocate={setUserLocation} />
          </div>

          <form onSubmit={handleSearchSubmit} className="flex flex-col sm:flex-row gap-3 mb-8">
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

            <select
              value={categoryFilter}
              onChange={(e) => handleCategoryChange(e.target.value)}
              aria-label={t('cats_category_label')}
              className="inp sm:w-auto"
            >
              <option value="">{t('cats_all_categories')}</option>
              {CATEGORY_TILES.map((c) => (
                <option key={c.category} value={c.category}>
                  {t(c.labelKey)}
                </option>
              ))}
            </select>

            <button
              type="submit"
              className="tap-target bg-brand text-white font-bold text-sm px-6 py-2.5 rounded-full hover:opacity-90 transition sm:w-auto"
            >
              {t('cats_search_button')}
            </button>
          </form>

          {isFiltering ? (
            <div className="mb-10">
              <h2 className="text-base font-bold text-slate-900 mb-3">
                {isSearching
                  ? t('cats_search_results_title').replace('{query}', appliedQuery.trim())
                  : t('cats_showing_category_title').replace('{category}', categoryFilterLabel ? t(categoryFilterLabel) : appliedCategoryFilter)}
              </h2>
              {filteredResults.length > 0 ? (
                <div className="flex flex-wrap gap-2.5 sm:gap-3">
                  {filteredResults.map((offer) => (
                    <OfferCard key={offer.id} offer={offer} />
                  ))}
                </div>
              ) : isSearching ? (
                <div className="dash-empty-state bg-white border border-slate-100 rounded-2xl">
                  <i className="fa-solid fa-magnifying-glass"></i>
                  <div className="font-bold text-slate-700 text-base mb-1">{t('cats_search_no_results_title').replace('{query}', appliedQuery.trim())}</div>
                  <p className="text-sm text-slate-500 max-w-xs">{t('cats_search_no_results_sub')}</p>
                </div>
              ) : (
                <div className="dash-empty-state bg-white border border-slate-100 rounded-2xl">
                  <i className="fa-solid fa-tags"></i>
                  <div className="font-bold text-slate-700 text-base mb-1">{t('deals_empty_title')}</div>
                  <p className="text-sm text-slate-500 max-w-xs">{t('deals_empty_sub')}</p>
                </div>
              )}
            </div>
          ) : (
            <>
              {nearby && (
                <div className="mb-8">
                  <h2 className={`text-sm font-bold text-slate-900 ${nearby.length > 0 && placeName ? 'mb-1' : 'mb-3'}`}>{t('discover_nearby_title')}</h2>
                  {nearby.length > 0 && placeName && (
                    <p className="text-xs text-slate-500 mb-3">{t('discover_nearby_place').replace('{place}', placeName)}</p>
                  )}
                  {nearby.length === 0 ? (
                    <div className="dash-empty-state bg-white border border-slate-100 rounded-2xl">
                      <i className="fa-solid fa-tags"></i>
                      <div className="font-bold text-slate-700 text-base mb-1">{t('deals_empty_title')}</div>
                      <p className="text-sm text-slate-500 max-w-xs">{t('deals_empty_sub')}</p>
                    </div>
                  ) : (
                    <div className="space-y-6">
                      {Array.from(nearbyByCategory!.entries()).map(([category, businesses]) => (
                        <div key={category}>
                          <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2.5">{category}</h3>
                          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
                            {businesses.map((business) => (
                              <div key={business.id} className="bg-white border border-slate-100 rounded-2xl p-4">
                                <div className="font-bold text-slate-900 text-sm">{business.name}</div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {(newOffers.length > 0 || (bestsellerOffers && bestsellerOffers.length > 0) || (offersByCategory && offersByCategory.size > 0)) && (
                <div className="divide-y divide-slate-100 mb-10">
                  {newOffers.length > 0 && (
                    <div className="py-8 first:pt-0 last:pb-0">
                      <div className="flex items-center justify-between gap-3 mb-3">
                        <div className="flex items-center gap-2">
                          <span className="text-xl">✨</span>
                          <h2 className="text-base font-bold text-slate-900">{t('row_new')}</h2>
                        </div>
                        <Link href="/categories/new" className="text-sm font-bold text-brand hover:underline flex-shrink-0">
                          {t('cats_see_more')}
                        </Link>
                      </div>
                      <div className="flex gap-2.5 sm:gap-3 overflow-x-auto scroll-x pb-1">
                        {newOffers.slice(0, 6).map((offer) => (
                          <OfferCard key={offer.id} offer={offer} />
                        ))}
                      </div>
                    </div>
                  )}

                  {bestsellerOffers && bestsellerOffers.length > 0 && (
                    <div className="py-8 first:pt-0 last:pb-0">
                      <div className="flex items-center justify-between gap-3 mb-3">
                        <div className="flex items-center gap-2">
                          <span className="text-xl">🔥</span>
                          <h2 className="text-base font-bold text-slate-900">{t('row_bestsellers')}</h2>
                        </div>
                        <Link href="/categories/bestsellers" className="text-sm font-bold text-brand hover:underline flex-shrink-0">
                          {t('cats_see_more')}
                        </Link>
                      </div>
                      <div className="flex gap-2.5 sm:gap-3 overflow-x-auto scroll-x pb-1">
                        {bestsellerOffers.slice(0, 6).map((offer) => (
                          <OfferCard key={offer.id} offer={offer} />
                        ))}
                      </div>
                    </div>
                  )}

                  {offersByCategory && CATEGORY_TILES.map((tile) => {
                    const categoryOffers = offersByCategory.get(tile.category)
                    if (!categoryOffers || categoryOffers.length === 0) return null
                    return (
                      <div key={tile.category} className="py-8 first:pt-0 last:pb-0">
                        <div className="flex items-center justify-between gap-3 mb-3">
                          <div className="flex items-center gap-2">
                            <span className="text-xl">{tile.emoji}</span>
                            <h2 className="text-base font-bold text-slate-900">{t(tile.labelKey)}</h2>
                          </div>
                          <Link href={`/categories/${encodeURIComponent(tile.category)}`} className="text-sm font-bold text-brand hover:underline flex-shrink-0">
                            {t('cats_see_more')}
                          </Link>
                        </div>
                        <div className="flex gap-2.5 sm:gap-3 overflow-x-auto scroll-x pb-1">
                          {categoryOffers.slice(0, 6).map((offer) => (
                            <OfferCard key={offer.id} offer={offer} />
                          ))}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}

              <div>
                <h2 className="text-sm font-bold text-slate-900 mb-3">{t('cats_all_categories_title')}</h2>
                <div className="flex gap-2 overflow-x-auto scroll-x pb-1">
                  {TILES.map((tile, i) => (
                    <CompactTile key={i} tile={tile} t={t} />
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  )
}

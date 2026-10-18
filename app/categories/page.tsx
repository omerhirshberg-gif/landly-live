'use client'

import { Suspense, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import Navbar from '@/components/layout/Navbar'
import NearMeButton from '@/components/discover/NearMeButton'
import OfferCard, { OFFER_FEED_GRID } from '@/components/discover/OfferCard'
import CategoryGrid from '@/components/perks/CategoryGrid'
import PerksToolbar from '@/components/perks/PerksToolbar'
import { usePerksUrlState } from '@/components/perks/usePerksUrlState'
import { useLang } from '@/lib/i18n/useLang'
import { sortByDistance, reverseGeocode, Coordinates } from '@/lib/geo'
import type { Business } from '@/lib/types/business'
import { CATEGORY_TILES, countOffersByCategory, filterCategoryTiles, perksCountLabel } from '@/lib/categories'
import { getAllOffers, getBestsellerOffers, isOfferNew, OfferDocument } from '@/lib/firebase/offers'
import { filterAndSortPerks, hasActivePerkFilters, normalizeQuery } from '@/lib/perks/perksFilter'

// No businesses onboarded yet — populated once real listings exist.
const BUSINESSES: Business[] = []

// A curated highlight row (New, Best Sellers): title, "See more", and the
// first six offers in a horizontal strip.
function OfferRow({ emoji, title, href, offers, seeMore }: { emoji: string; title: string; href: string; offers: OfferDocument[]; seeMore: string }) {
  return (
    <div className="py-8 first:pt-0 last:pb-0">
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-2">
          <span className="text-xl">{emoji}</span>
          <h2 className="text-base font-bold text-slate-900">{title}</h2>
        </div>
        <Link href={href} className="text-sm font-bold text-brand hover:underline flex-shrink-0">
          {seeMore}
        </Link>
      </div>
      <div className="flex gap-2.5 sm:gap-3 overflow-x-auto scroll-x pb-1">
        {offers.slice(0, 6).map((offer) => (
          <OfferCard key={offer.id} offer={offer} />
        ))}
      </div>
    </div>
  )
}

function Spinner() {
  return (
    <div className="dash-empty-state">
      <i className="fa-solid fa-spinner fa-spin" aria-hidden="true"></i>
    </div>
  )
}

// The perks catalog. At rest (All, no search, Recommended) it's the
// overview: the search row (no chips or Sort), category tiles with counts,
// then the New and Best Sellers rows. A search, a tapped tile (?cat=) or a
// non-default sort switches to one filtered, sorted grid of offers, and only
// then do the chips and Sort appear. The filters live in the URL (?cat=&sort=&q=), so the view
// survives reloads and can be shared; all filtering runs on the one fetched
// list (lib/perks/perksFilter.ts, shared with the app's Perks tab).
function PerksBrowser() {
  const { t, lang } = useLang()
  const { query, setQuery, appliedQuery, category, setCategory, sort, setSort } = usePerksUrlState()
  const [userLocation, setUserLocation] = useState<Coordinates | null>(null)
  const [placeName, setPlaceName] = useState<string | null>(null)
  const [offers, setOffers] = useState<OfferDocument[] | undefined>(undefined)
  const [bestsellerOffers, setBestsellerOffers] = useState<OfferDocument[] | undefined>(undefined)

  const nearby = userLocation ? sortByDistance(BUSINESSES, userLocation) : null

  useEffect(() => {
    getAllOffers().then(setOffers)
    getBestsellerOffers().then(setBestsellerOffers)
  }, [])

  const filters = { query: appliedQuery, category, sort }
  const filtering = hasActivePerkFilters(filters)
  const normalizedQuery = normalizeQuery(appliedQuery)

  const counts = useMemo(() => (offers ? countOffersByCategory(offers) : null), [offers])
  const results = useMemo(
    () => (offers && filtering ? filterAndSortPerks(offers, { query: appliedQuery, category, sort }, t, lang) : []),
    // `t` changes identity every render; `lang` covers what it depends on.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [offers, filtering, appliedQuery, category, sort, lang]
  )
  // A search across All also surfaces the categories it names.
  const matchingTiles = normalizedQuery && category === 'all' ? filterCategoryTiles(CATEGORY_TILES, normalizedQuery, t) : []
  const newOffers = offers?.filter((offer) => isOfferNew(offer.createdAt)) ?? []
  const selectedTile = CATEGORY_TILES.find((tile) => tile.category === category)

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

  // The page heading carries the selected category, so the results heading
  // only names a search, or "All" for a sort over everything; a category on
  // its own shows just the count under the page heading.
  const pageTitle = selectedTile ? t(selectedTile.labelKey) : t('cats_page_title')
  const resultsTitle = normalizedQuery
    ? t('cats_search_results_title').replace('{query}', appliedQuery.trim())
    : selectedTile
      ? null
      : t('cats_filter_all')

  return (
    <>
      <PageHeading title={pageTitle} />
      <div className="mb-8">
        <PerksToolbar
          query={query}
          onQueryChange={setQuery}
          category={category}
          onCategoryChange={setCategory}
          sort={sort}
          onSortChange={setSort}
          showFilters={filtering}
          action={<NearMeButton variant="action" onLocate={setUserLocation} onClear={() => setUserLocation(null)} />}
        />
      </div>

      {filtering ? (
        <div className="mb-10 space-y-8">
          {matchingTiles.length > 0 && (
            <section>
              <h2 className="text-base font-bold text-slate-900 mb-3">{t('cats_matching_categories')}</h2>
              <CategoryGrid tiles={matchingTiles} counts={counts} />
            </section>
          )}

          {offers === undefined ? (
            <Spinner />
          ) : results.length > 0 ? (
            <section aria-live="polite">
              <div className="mb-3 flex flex-wrap items-baseline gap-x-2">
                {resultsTitle && <h2 className="text-base font-bold text-slate-900 break-words">{resultsTitle}</h2>}
                <span className="text-sm text-slate-500">{perksCountLabel(results.length, t)}</span>
              </div>
              <div className={`${OFFER_FEED_GRID} touch-pan-y touch-pinch-zoom`}>
                {results.map((offer) => (
                  <OfferCard key={offer.id} offer={offer} layout="grid" showCategoryBadge={category === 'all'} />
                ))}
              </div>
            </section>
          ) : (
            matchingTiles.length === 0 && (
              <div aria-live="polite" className="dash-empty-state bg-white border border-slate-100 rounded-2xl">
                <i className={normalizedQuery ? 'fa-solid fa-magnifying-glass' : 'fa-solid fa-tags'} aria-hidden="true"></i>
                <div className="font-bold text-slate-700 text-base mb-1">
                  {normalizedQuery ? t('cats_search_no_results_title').replace('{query}', appliedQuery.trim()) : t('deals_empty_title')}
                </div>
                <p className="text-sm text-slate-500 max-w-xs">{normalizedQuery ? t('cats_search_no_results_sub') : t('deals_empty_sub')}</p>
              </div>
            )
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
                  <i className="fa-solid fa-tags" aria-hidden="true"></i>
                  <div className="font-bold text-slate-700 text-base mb-1">{t('deals_empty_title')}</div>
                  <p className="text-sm text-slate-500 max-w-xs">{t('deals_empty_sub')}</p>
                </div>
              ) : (
                <div className="space-y-6">
                  {Array.from(nearbyByCategory!.entries()).map(([group, businesses]) => (
                    <div key={group}>
                      <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2.5">{group}</h3>
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

          <section className="mb-10">
            <h2 className="text-base font-bold text-slate-900 mb-3">{t('cats_all_categories_title')}</h2>
            <CategoryGrid tiles={CATEGORY_TILES} counts={counts} />
          </section>

          {(newOffers.length > 0 || (bestsellerOffers && bestsellerOffers.length > 0)) && (
            <div className="divide-y divide-slate-100 mb-10">
              {newOffers.length > 0 && (
                <OfferRow emoji="✨" title={t('row_new')} href="/categories/new" offers={newOffers} seeMore={t('cats_see_more')} />
              )}
              {bestsellerOffers && bestsellerOffers.length > 0 && (
                <OfferRow emoji="🔥" title={t('row_bestsellers')} href="/categories/bestsellers" offers={bestsellerOffers} seeMore={t('cats_see_more')} />
              )}
            </div>
          )}
        </>
      )}
    </>
  )
}

// The heading names the selected category, so it reads ?cat= and lives
// inside the Suspense boundary. Its fallback holds the same height with no
// text: a ?cat= link never flashes "All Categories" before hydration, and
// nothing shifts when the real heading arrives.
function PageHeading({ title }: { title?: string }) {
  return title ? (
    <h1 className="text-2xl sm:text-3xl font-black text-slate-900 mb-5 break-words">{title}</h1>
  ) : (
    <div aria-hidden="true" className="h-8 sm:h-9 mb-5" />
  )
}

export default function CategoriesPage() {
  return (
    <>
      <Navbar />
      <div className="pt-16">
        <div className="max-w-member mx-auto px-4 sm:px-6 py-8 sm:py-10">
          <Suspense
            fallback={
              <>
                <PageHeading />
                <Spinner />
              </>
            }
          >
            <PerksBrowser />
          </Suspense>
        </div>
      </div>
    </>
  )
}

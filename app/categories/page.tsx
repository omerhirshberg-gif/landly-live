'use client'

import { Suspense, useEffect, useMemo, useState } from 'react'
import Navbar from '@/components/layout/Navbar'
import NearMeButton from '@/components/discover/NearMeButton'
import OfferCard, { OFFER_FEED_GRID } from '@/components/discover/OfferCard'
import OfferTileRail from '@/components/discover/OfferTileRail'
import CategoryGrid from '@/components/perks/CategoryGrid'
import PerksToolbar from '@/components/perks/PerksToolbar'
import SectionDivider from '@/components/ui/SectionDivider'
import { usePerksUrlState } from '@/components/perks/usePerksUrlState'
import { useLang } from '@/lib/i18n/useLang'
import { sortByDistance, reverseGeocode, Coordinates } from '@/lib/geo'
import type { Business } from '@/lib/types/business'
import { CATEGORY_TILES, countOffersByCategory, filterCategoryTiles, perksCountLabel } from '@/lib/categories'
import { getAllOffers, isOfferAvailable, isOfferNew, OfferDocument, sortFeaturedOffers } from '@/lib/firebase/offers'
import { filterAndSortPerks, hasActivePerkFilters, normalizeQuery } from '@/lib/perks/perksFilter'

// No businesses onboarded yet — populated once real listings exist.
const BUSINESSES: Business[] = []

function Spinner() {
  return (
    <div className="dash-empty-state">
      <i className="fa-solid fa-spinner fa-spin" aria-hidden="true"></i>
    </div>
  )
}

// The perks catalog. At rest (All, no search, Recommended) it's the
// overview: the search row (no chips or Sort), the New on Landly and Best
// Sellers rails (OfferTileRail, real perks still claimable only), then the
// full category grid with counts, a soft hairline (SectionDivider) between
// each block, as on the home page. A search, a tapped tile (?cat=) or a
// non-default sort switches to one filtered, sorted grid of full offer
// cards, and only then do the chips and Sort appear. The filters live in the URL (?cat=&sort=&q=), so the view
// survives reloads and can be shared; all filtering runs on the one fetched
// list (lib/perks/perksFilter.ts, shared with the app's Perks tab).
function PerksBrowser() {
  const { t, lang } = useLang()
  const { query, setQuery, appliedQuery, category, setCategory, sort, setSort } = usePerksUrlState()
  const [userLocation, setUserLocation] = useState<Coordinates | null>(null)
  const [placeName, setPlaceName] = useState<string | null>(null)
  const [offers, setOffers] = useState<OfferDocument[] | undefined>(undefined)

  const nearby = userLocation ? sortByDistance(BUSINESSES, userLocation) : null

  useEffect(() => {
    getAllOffers().then(setOffers)
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
  // The overview's two rails: one fetch, sold-out offers left out, bestsellers then newest.
  const railOffers = useMemo(() => (offers ? sortFeaturedOffers(offers.filter(isOfferAvailable)) : []), [offers])
  const newOffers = railOffers.filter((offer) => isOfferNew(offer.createdAt))
  const bestsellerOffers = railOffers.filter((offer) => offer.isBestseller)
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
              <h2 className="text-base font-bold text-ink mb-3">{t('cats_matching_categories')}</h2>
              <CategoryGrid tiles={matchingTiles} counts={counts} />
            </section>
          )}

          {offers === undefined ? (
            <Spinner />
          ) : results.length > 0 ? (
            <section aria-live="polite">
              <div className="mb-3 flex flex-wrap items-baseline gap-x-2">
                {resultsTitle && <h2 className="text-base font-bold text-ink break-words">{resultsTitle}</h2>}
                <span className="text-sm text-body">{perksCountLabel(results.length, t)}</span>
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
                <div className="font-bold text-ink text-base mb-1">
                  {normalizedQuery ? t('cats_search_no_results_title').replace('{query}', appliedQuery.trim()) : t('deals_empty_title')}
                </div>
                <p className="text-sm text-body max-w-xs">{normalizedQuery ? t('cats_search_no_results_sub') : t('deals_empty_sub')}</p>
              </div>
            )
          )}
        </div>
      ) : (
        <>
          {nearby && (
            <div className="mb-8">
              <h2 className={`text-sm font-bold text-ink ${nearby.length > 0 && placeName ? 'mb-1' : 'mb-3'}`}>{t('discover_nearby_title')}</h2>
              {nearby.length > 0 && placeName && (
                <p className="text-xs text-body mb-3">{t('discover_nearby_place').replace('{place}', placeName)}</p>
              )}
              {nearby.length === 0 ? (
                <div className="dash-empty-state bg-white border border-slate-100 rounded-2xl">
                  <i className="fa-solid fa-tags" aria-hidden="true"></i>
                  <div className="font-bold text-ink text-base mb-1">{t('deals_empty_title')}</div>
                  <p className="text-sm text-body max-w-xs">{t('deals_empty_sub')}</p>
                </div>
              ) : (
                <div className="space-y-6">
                  {Array.from(nearbyByCategory!.entries()).map(([group, businesses]) => (
                    <div key={group}>
                      <h3 className="text-xs font-bold text-muted uppercase tracking-wide mb-2.5">{group}</h3>
                      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
                        {businesses.map((business) => (
                          <div key={business.id} className="bg-white border border-slate-100 rounded-2xl p-4">
                            <div className="font-bold text-ink text-sm">{business.name}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {(newOffers.length > 0 || bestsellerOffers.length > 0) && (
            <>
              <SectionDivider className="mb-8" />
              {/* The rails pad themselves (py-5), so the hairline between them needs no spacing of its own. */}
              <div className="mb-8">
                {newOffers.length > 0 && (
                  <OfferTileRail icon="fa-wand-magic-sparkles" title={t('row_new')} href="/categories/new" seeMore={t('cats_see_more')} offers={newOffers} />
                )}
                {newOffers.length > 0 && bestsellerOffers.length > 0 && <SectionDivider />}
                {bestsellerOffers.length > 0 && (
                  <OfferTileRail icon="fa-fire" title={t('row_bestsellers')} href="/categories/bestsellers" seeMore={t('cats_see_more')} offers={bestsellerOffers} />
                )}
              </div>
            </>
          )}

          <SectionDivider className="mb-8" />

          <section className="mb-10">
            <h2 className="text-base font-bold text-ink mb-3">{t('cats_all_categories_title')}</h2>
            <CategoryGrid tiles={CATEGORY_TILES} counts={counts} />
          </section>
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
    <h1 className="text-[26px] sm:text-[28px] lg:text-3xl leading-tight font-bold text-ink mb-5 break-words">{title}</h1>
  ) : (
    <div aria-hidden="true" className="h-[33px] sm:h-[35px] lg:h-[38px] mb-5" />
  )
}

export default function CategoriesPage() {
  return (
    <>
      <Navbar />
      <div className="below-header member-canvas">
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

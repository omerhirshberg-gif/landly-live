'use client'

import { Suspense, useEffect, useMemo, useState } from 'react'
import Navbar from '@/components/layout/Navbar'
import NearMeButton from '@/components/discover/NearMeButton'
import OfferCard, { OFFER_FEED_GRID } from '@/components/discover/OfferCard'
import OfferTileRail from '@/components/discover/OfferTileRail'
import { Award, MapPin, Search, Sparkles, Tags } from 'lucide-react'
import CategoryGrid from '@/components/perks/CategoryGrid'
import PerksToolbar from '@/components/perks/PerksToolbar'
import SectionDivider from '@/components/ui/SectionDivider'
import { OfferGridSkeleton } from '@/components/ui/Skeleton'
import MemberPageShell, { PAGE_TITLE_GAP, PageTitle } from '@/components/layout/MemberPageShell'
import { usePerksUrlState } from '@/components/perks/usePerksUrlState'
import { useLang } from '@/lib/i18n/useLang'
import { deriveAreas, localizedName, reverseGeocode, type Area, type Coordinates } from '@/lib/geo'
import { CATEGORY_TILES, filterCategoryTiles, perksCountLabel } from '@/lib/categories'
import { getAllOffers, isOfferAvailable, isOfferNew, OfferDocument, sortFeaturedOffers } from '@/lib/firebase/offers'
import { filterAndSortPerks, hasActivePerkFilters, normalizeQuery, offerDistanceKm, sortByNearest } from '@/lib/perks/perksFilter'

/** The location "Near me" applies: the member's own, or an area they picked instead. */
type Origin = { coords: Coordinates; area: Area | null }

const NEARBY_MAX = 12

// The perks catalog. At rest (All, no search, Recommended) it's the
// overview: the search row (no chips or Sort), the New on Landly and Best
// Sellers rails (OfferTileRail, real perks still claimable only), then the
// full category grid, a soft hairline (SectionDivider) between
// each block, as on the home page. A search, a tapped tile (?cat=) or a
// non-default sort switches to one filtered, sorted grid of full offer
// cards, and only then do the chips and Sort appear. The filters live in the URL (?cat=&sort=&q=), so the view
// survives reloads and can be shared; all filtering runs on the one fetched
// list (lib/perks/perksFilter.ts, shared with the app's Perks tab).
function PerksBrowser() {
  const { t, lang } = useLang()
  const { query, setQuery, appliedQuery, category, setCategory, sort, setSort } = usePerksUrlState()
  const [origin, setOrigin] = useState<Origin | null>(null)
  const [geocodedPlace, setGeocodedPlace] = useState<string | null>(null)
  const [offers, setOffers] = useState<OfferDocument[] | undefined>(undefined)

  useEffect(() => {
    getAllOffers().then(setOffers)
  }, [])

  const filters = { query: appliedQuery, category, sort }
  const filtering = hasActivePerkFilters(filters)
  const normalizedQuery = normalizeQuery(appliedQuery)

  const originCoords = origin?.coords ?? null
  const results = useMemo(
    () => (offers && filtering ? filterAndSortPerks(offers, { query: appliedQuery, category, sort }, t, lang, originCoords) : []),
    // `t` changes identity every render; `lang` covers what it depends on.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [offers, filtering, appliedQuery, category, sort, lang, originCoords]
  )
  // "Choose area" when the browser has no location: the cities with perks.
  const areas = useMemo(() => (offers ? deriveAreas(offers.filter(isOfferAvailable)) : []), [offers])
  // A search across All also surfaces the categories it names.
  const matchingTiles = normalizedQuery && category === 'all' ? filterCategoryTiles(CATEGORY_TILES, normalizedQuery, t) : []
  // The overview's two rails: one fetch, sold-out offers left out, bestsellers then newest.
  const railOffers = useMemo(() => (offers ? sortFeaturedOffers(offers.filter(isOfferAvailable)) : []), [offers])
  const newOffers = railOffers.filter((offer) => isOfferNew(offer.createdAt))
  const bestsellerOffers = railOffers.filter((offer) => offer.isBestseller)
  const selectedTile = CATEGORY_TILES.find((tile) => tile.category === category)

  // The member's own location gets its city from the cached Geocoding proxy; a picked area names itself.
  useEffect(() => {
    setGeocodedPlace(null)
    if (!originCoords || origin?.area) return
    let cancelled = false
    reverseGeocode(originCoords, lang).then((city) => {
      if (!cancelled) setGeocodedPlace(city)
    })
    return () => { cancelled = true }
  }, [originCoords, origin?.area, lang])
  const placeName = origin?.area ? localizedName(origin.area.name, lang) : geocodedPlace
  // The overview's Nearby section: claimable perks with a location, nearest first.
  const nearby = useMemo(
    () => (originCoords ? sortByNearest(railOffers.filter((offer) => offer.geo), originCoords).slice(0, NEARBY_MAX) : null),
    [railOffers, originCoords]
  )

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
          action={
            <NearMeButton
              active={!!origin}
              onLocate={(coords) => setOrigin({ coords, area: null })}
              onClear={() => setOrigin(null)}
              areas={areas}
              onChooseArea={(area) => setOrigin({ coords: area.center, area })}
            />
          }
        />
      </div>

      {filtering ? (
        <div className="mb-10 space-y-8">
          {matchingTiles.length > 0 && (
            <section>
              <h2 className="text-base font-bold text-ink mb-3">{t('cats_matching_categories')}</h2>
              <CategoryGrid tiles={matchingTiles} />
            </section>
          )}

          {offers === undefined ? (
            <OfferGridSkeleton />
          ) : results.length > 0 ? (
            <section aria-live="polite">
              <div className="mb-3 flex flex-wrap items-baseline gap-x-2">
                {resultsTitle && <h2 className="text-base font-bold text-ink break-words">{resultsTitle}</h2>}
                <span className="text-sm text-body">{perksCountLabel(results.length, t)}</span>
              </div>
              <div className={`${OFFER_FEED_GRID} touch-pan-y touch-pinch-zoom`}>
                {results.map((offer) => (
                  <OfferCard key={offer.id} offer={offer} layout="grid" showCategoryBadge={category === 'all'} distanceKm={offerDistanceKm(offer, originCoords)} />
                ))}
              </div>
            </section>
          ) : (
            matchingTiles.length === 0 && (
              <div aria-live="polite" className="dash-empty-state bg-white border border-slate-100 rounded-2xl">
                {normalizedQuery ? <Search aria-hidden="true" strokeWidth={1.75} /> : <Tags aria-hidden="true" strokeWidth={1.75} />}
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
            <section className="mb-8" aria-live="polite">
              <h2 className={`text-base font-bold text-ink ${placeName ? 'mb-1' : 'mb-3'}`}>{t('discover_nearby_title')}</h2>
              {placeName && (
                <p className="text-sm text-body mb-3">
                  {/* <bdi>: a Hebrew city inside an English sentence (or the reverse) keeps its own order. */}
                  {t('discover_nearby_place').split('{place}').map((part, i) => (
                    <span key={i}>
                      {i > 0 && <bdi className="font-semibold text-ink">{placeName}</bdi>}
                      {part}
                    </span>
                  ))}
                </p>
              )}
              {nearby.length === 0 ? (
                <div className="dash-empty-state bg-white border border-slate-100 rounded-2xl">
                  <MapPin aria-hidden="true" strokeWidth={1.75} />
                  <div className="font-bold text-ink text-base mb-1">{t('geo_nearby_empty_title')}</div>
                  <p className="text-sm text-body max-w-xs">{t('geo_nearby_empty_sub')}</p>
                </div>
              ) : (
                <div className={`${OFFER_FEED_GRID} touch-pan-y touch-pinch-zoom`}>
                  {nearby.map((offer) => (
                    <OfferCard key={offer.id} offer={offer} layout="grid" distanceKm={offerDistanceKm(offer, originCoords)} />
                  ))}
                </div>
              )}
            </section>
          )}

          {(newOffers.length > 0 || bestsellerOffers.length > 0) && (
            <>
              <SectionDivider className="mb-8" />
              {/* The rails pad themselves (py-5), so the hairline between them needs no spacing of its own. */}
              <div className="mb-8">
                {newOffers.length > 0 && (
                  <OfferTileRail icon={Sparkles} title={t('row_new')} href="/categories/new" seeMore={t('cats_see_more')} offers={newOffers} />
                )}
                {newOffers.length > 0 && bestsellerOffers.length > 0 && <SectionDivider />}
                {bestsellerOffers.length > 0 && (
                  <OfferTileRail icon={Award} title={t('row_bestsellers')} href="/categories/bestsellers" seeMore={t('cats_see_more')} offers={bestsellerOffers} />
                )}
              </div>
            </>
          )}

          <SectionDivider className="mb-8" />

          <section className="mb-10">
            <h2 className="text-base font-bold text-ink mb-3">{t('cats_all_categories_title')}</h2>
            <CategoryGrid tiles={CATEGORY_TILES} />
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
    <PageTitle>{title}</PageTitle>
  ) : (
    <div aria-hidden="true" className={`h-[33px] sm:h-[35px] lg:h-[38px] ${PAGE_TITLE_GAP}`} />
  )
}

export default function CategoriesPage() {
  return (
    <>
      <Navbar />
      <div className="below-header member-canvas">
        <MemberPageShell>
          <Suspense
            fallback={
              <>
                <PageHeading />
                <OfferGridSkeleton />
              </>
            }
          >
            <PerksBrowser />
          </Suspense>
        </MemberPageShell>
      </div>
    </>
  )
}

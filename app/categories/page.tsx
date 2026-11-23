'use client'

import { Suspense, useDeferredValue, useMemo, useState } from 'react'
import Navbar from '@/components/layout/Navbar'
import OfferCard from '@/components/discover/OfferCard'
import ShareFriendButton from '@/components/discover/ShareFriendButton'
import { OFFER_RESULTS_GRID } from '@/components/discover/offerFeedGrid'
import OfferTileRail from '@/components/discover/OfferTileRail'
import { isFlagship, isRaayonitOffer, landlyOffers } from '@/lib/offers/discoverTab'
import { selectChainsPreview } from '@/lib/home/chainsPreview'
import { useRaayonitDisplay } from '@/lib/flags/raayonitDisplayStore'
import LiveChainsSection from '@/components/perks/LiveChainsSection'
import PerksSoonCard from '@/components/perks/PerksSoonCard'
import { Award, MapPin, Search, CirclePlus, Tags } from 'lucide-react'
import { buildCategoryRails, isSuperVoucher, railLabel } from '@/lib/home/categoryRails'
import OfferCardRail from '@/components/discover/OfferCardRail'
import CategoryIcon from '@/components/ui/CategoryIcon'
import CategoryGrid from '@/components/perks/CategoryGrid'
import PerksToolbar from '@/components/perks/PerksToolbar'
import SectionDivider from '@/components/ui/SectionDivider'
import { OfferGridSkeleton } from '@/components/ui/Skeleton'
import MemberPageShell, { MemberColumn, PAGE_TITLE_GAP, PageTitle } from '@/components/layout/MemberPageShell'
import { PerksUrlStateProvider, usePerksUrlContext } from '@/components/perks/PerksUrlStateContext'
import { usePerksSearch } from '@/lib/perks/PerksSearchProvider'
import BackButton from '@/components/navigation/BackButton'
import { useLang } from '@/lib/i18n/useLang'
import { CATEGORY_TILES, filterCategoryTiles } from '@/lib/categories'
import LocationFilterBar from '@/components/discover/LocationFilterBar'
import { applyLocationFilterWithNationwide, badgeKm, partitionByLocation, sortByLocation } from '@/lib/perks/locationFilter'
import { locationCountLabel } from '@/lib/perks/locationCount'
import { isOfferAvailable, isOfferNew, sortFeaturedOffers } from '@/lib/firebase/offers'
import { useOffers } from '@/lib/offers/useOffers'
import { categoryHref, DEFAULT_PERK_SORT, filterAndSortPerks, hasActivePerkFilters, normalizeQuery } from '@/lib/perks/perksFilter'

const NEARBY_MAX = 12

// The perks catalog. At rest (All, no search, Recommended) it's the
// overview: the search row (no chips or Sort), the New on GoLandly and Best
// Sellers rails (OfferTileRail, real perks still claimable only), then the
// full category grid, a soft hairline (SectionDivider) between
// each block, as on the home page. A search, a tapped tile (?cat=) or a
// non-default sort switches to one filtered, sorted grid of full offer
// cards, and only then do the chips and Sort appear. The filters live in the URL (?cat=&sort=&q=), so the view
// survives reloads and can be shared; all filtering runs on the one fetched
// list (lib/perks/perksFilter.ts, shared with the app's Perks tab).
function PerksBrowser() {
  const { t, lang } = useLang()
  // Search, Sort and the filters are edited by the persistent bar above (GlobalPerkSearchBar); this reads the same URL state.
  const { appliedQuery, category, setCategory, sort, method, minDiscount, kind, brand } = usePerksUrlContext()!
  const { origin, filter, setRadiusKm, setAreaPick, setOrigin } = usePerksSearch()
  // The shared catalog (lib/offers/offersStore.ts): a held or saved copy draws on the first frame, so coming back here
  // never shows a skeleton; a stale copy refreshes behind it. A failed load with nothing to show offers a retry.
  const { offers: allOffers, failed, refresh } = useOffers()
  // This page is GoLandly's own perks only; Raayonit's "תו על" has its own tab (/raayonit).
  const offers = useMemo(() => (allOffers ? landlyOffers(allOffers) : allOffers), [allOffers])
  // While GoLandly has no direct perks the page points at the Raayonit Card tab: the live chains section, which opens the tab (the name follows the display flag).
  const showRaayonit = useRaayonitDisplay()
  const raayonitOffers = useMemo(() => (allOffers ?? []).filter(isRaayonitOffer), [allOffers])
  const chainCount = useMemo(() => raayonitOffers.filter((o) => !isFlagship(o)).length, [raayonitOffers])
  const liveShown = showRaayonit && chainCount > 0
  const chainsPreview = useMemo(() => selectChainsPreview(raayonitOffers, lang), [raayonitOffers, lang])
  const [retrying, setRetrying] = useState(false)
  const retry = () => {
    setRetrying(true)
    refresh().finally(() => setRetrying(false))
  }

  // The chips and filters highlight on the click's frame; the grid is filtered against these deferred copies, in the background.
  const listQuery = useDeferredValue(appliedQuery)
  const listCategory = useDeferredValue(category)
  const listSort = useDeferredValue(sort)
  const listMethod = useDeferredValue(method)
  const listMinDiscount = useDeferredValue(minDiscount)
  const filtering = hasActivePerkFilters({ query: appliedQuery, category, sort, method, minDiscount, kind, brand })
  const normalizedQuery = normalizeQuery(listQuery)

  const originCoords = origin?.coords ?? null
  // Near me / a picked area narrows every list on the page (lib/perks/locationFilter.ts).
  const located = useMemo(() => (offers ? applyLocationFilterWithNationwide(offers, filter) : undefined), [offers, filter])
  // Nothing real in this radius or area: only multi-chain passes and unplaceable nationwide chains are left.
  const locEmpty = !!filter && !!offers && !partitionByLocation(offers, filter).nearby.some((o) => o.perkScope !== 'multi_chain')
  const { nearbyResults, nationwideResults } = useMemo(() => {
    if (!offers || !filtering) return { nearbyResults: [], nationwideResults: [] }
    const matched = filterAndSortPerks(offers, { query: listQuery, category: listCategory, sort: listSort, method: listMethod, minDiscount: listMinDiscount, kind, brand }, t, lang, null)
    const parts = partitionByLocation(matched, filter)
    return { nearbyResults: sortByLocation(parts.nearby, listSort === DEFAULT_PERK_SORT ? filter : null), nationwideResults: parts.nationwide }
  }, [offers, filtering, listQuery, listCategory, listSort, listMethod, listMinDiscount, kind, brand, t, lang, filter])
  const results = useMemo(() => [...nearbyResults, ...nationwideResults], [nearbyResults, nationwideResults])
  // A search across All also surfaces the categories it names.
  const matchingTiles = normalizedQuery && listCategory === 'all' ? filterCategoryTiles(CATEGORY_TILES, normalizedQuery, t) : []
  // The overview's two rails: one fetch, sold-out offers left out, bestsellers then newest.
  const railOffers = useMemo(() => (located ? sortFeaturedOffers(located.filter((o) => isOfferAvailable(o) && !isSuperVoucher(o))) : []), [located])
  const categoryRails = useMemo(() => (located ? buildCategoryRails(located) : []), [located])
  const newOffers = railOffers.filter((offer) => isOfferNew(offer.createdAt) && offer.fulfillmentType !== 'raayonit_pool')
  const bestsellerOffers = railOffers.filter((offer) => offer.isBestseller)
  const selectedTile = CATEGORY_TILES.find((tile) => tile.category === category)


  // The page heading carries the selected category, so the results heading
  // only names a search, or "All" for a sort over everything; a category on
  // its own shows just the count under the page heading.
  const pageTitle = selectedTile ? t(selectedTile.labelKey) : t('perks_explore_title')
  const resultsTitle = normalizedQuery
    ? t('cats_search_results_title').replace('{query}', listQuery.trim())
    : selectedTile
      ? null
      : t('cats_filter_all')

  return (
    <>
      {selectedTile && (
        // Clears the category and returns to the overview (the search, sort and filters stay).
        <BackButton fallback="/categories" label={t('nav_back')} onBack={() => setCategory('all')} className="mb-2" />
      )}
      <PageHeading title={pageTitle} />
      {offers !== null && offers !== undefined && offers.length === 0 && !failed && !filtering ? (<>
        {/* No direct perk yet: the Raayonit Card entry, one calm note, the categories to browse and a preview of the Raayonit chains. A search still falls through to the listing below. */}
        {liveShown && <LiveChainsSection offers={chainsPreview} chainCount={chainCount} nested className="mb-10" />}
        <PerksSoonCard quiet={liveShown} className="mb-10" />
        <section aria-labelledby="perks-browse-title" className="mb-10">
          <h2 id="perks-browse-title" className="mb-3.5 text-xl font-bold tracking-tight text-ink">{t('perks_browse_title')}</h2>
          <CategoryGrid tiles={CATEGORY_TILES} />
        </section>
      </>) : (<>
      {filtering && (
        <div className="mb-8">
          <PerksToolbar category={category} onCategoryChange={setCategory} showFilters={filtering} />
        </div>
      )}

      <LocationFilterBar className="mb-6" filter={filter} onRadius={setRadiusKm} onClear={() => { setOrigin(null); setAreaPick(null) }} />

      {failed && (
        <div role="alert" className="mb-8 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200/80 bg-white/80 px-4 py-3 shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
          <p className="text-sm font-medium text-body">{t('cats_load_error')}</p>
          <button type="button" onClick={retry} disabled={retrying} className="min-h-11 rounded-full px-4 text-sm font-bold text-brand transition-colors hover:bg-brand/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:opacity-50">
            {t('err_retry')}
          </button>
        </div>
      )}

      {filtering ? (
        <div className="mb-10 space-y-8">
          {matchingTiles.length > 0 && (
            <section>
              <h2 className="text-base font-bold text-ink mb-3">{t('cats_matching_categories')}</h2>
              <CategoryGrid tiles={matchingTiles} />
            </section>
          )}

          {offers === null ? (
            !failed && <OfferGridSkeleton />
          ) : results.length > 0 ? (
            <section aria-live="polite">
              <div className="mb-3 flex flex-wrap items-baseline gap-x-2">
                {resultsTitle && <h2 className="text-base font-bold text-ink break-words">{resultsTitle}</h2>}
                <span className="text-sm text-body">{locationCountLabel(nearbyResults.length, nationwideResults.length, t)}</span>
              </div>
              <div className={`${OFFER_RESULTS_GRID} touch-pan-y touch-pinch-zoom`}>
                {nearbyResults.map((offer) => (
                  <OfferCard key={offer.id} offer={offer} layout="grid" showCategoryBadge={listCategory === 'all'} distanceKm={badgeKm(offer, filter)} />
                ))}
              </div>
              {nationwideResults.length > 0 && (
                <>
                  <h2 className="mb-3 mt-8 text-base font-bold text-ink break-words">{t('loc_more_nationwide')}</h2>
                  <div className={`${OFFER_RESULTS_GRID} touch-pan-y touch-pinch-zoom`}>
                    {nationwideResults.map((offer) => (
                      <OfferCard key={offer.id} offer={offer} layout="grid" showCategoryBadge={listCategory === 'all'} nationwide />
                    ))}
                  </div>
                </>
              )}
              <ShareFriendButton className="mt-8" />
            </section>
          ) : (
            matchingTiles.length === 0 && (
              <div aria-live="polite" className="dash-empty-state bg-white border border-slate-100 rounded-2xl">
                {normalizedQuery ? <Search aria-hidden="true" strokeWidth={1.75} /> : <Tags aria-hidden="true" strokeWidth={1.75} />}
                <div className="font-bold text-ink text-base mb-1">
                  {normalizedQuery ? t('cats_search_no_results_title').replace('{query}', listQuery.trim()) : t('deals_empty_title')}
                </div>
                <p className="text-sm text-body max-w-xs">{normalizedQuery ? t('cats_search_no_results_sub') : t('deals_empty_sub')}</p>
              </div>
            )
          )}
        </div>
      ) : (
        <>
          <p className="mb-1 text-xs font-bold tracking-wide text-brand">{t('perks_landly_label')}</p>
          <h2 id="perks-landly-title" className="mb-3.5 text-[22px] font-extrabold tracking-tight text-ink sm:text-2xl">{t('perks_landly_title')}</h2>
          {locEmpty && (
            <div className="dash-empty-state mb-8 rounded-2xl border border-slate-100 bg-white" aria-live="polite">
              <MapPin aria-hidden="true" strokeWidth={1.75} />
              <div className="mb-1 text-base font-bold text-ink">{t('loc_empty_title').replace('{km}', String(filter?.kind === 'gps' ? filter.radiusKm : ''))}</div>
              <p className="max-w-xs text-sm text-body">{t('loc_empty_sub')}</p>
              {filter?.kind === 'gps' && filter.radiusKm < 25 && (
                <button type="button" onClick={() => setRadiusKm(filter.radiusKm === 5 ? 15 : 25)} className="mt-3 min-h-11 text-sm font-bold text-brand hover:underline">{t('loc_expand').replace('{km}', String(filter.radiusKm === 5 ? 15 : 25))}</button>
              )}
            </div>
          )}

          {(newOffers.length > 0 || bestsellerOffers.length > 0) && (
            <>
              <SectionDivider className="mb-8" />
              {/* The rails pad themselves (py-5), so the hairline between them needs no spacing of its own. */}
              <div className="mb-8">
                {newOffers.length > 0 && (
                  <OfferTileRail icon={CirclePlus} title={t('row_new')} href="/categories/new" seeMore={t('cats_see_more')} offers={newOffers} autoAdvance compact />
                )}
                {newOffers.length > 0 && bestsellerOffers.length > 0 && <SectionDivider />}
                {bestsellerOffers.length > 0 && (
                  <OfferTileRail icon={Award} title={t('row_bestsellers')} href="/categories/bestsellers" seeMore={t('cats_see_more')} offers={bestsellerOffers} autoAdvance autoAdvanceOffsetMs={2000} compact />
                )}
              </div>
            </>
          )}

          {/* One horizontal rail per category that holds a claimable perk, each with "See all (N)" to its full list. */}
          {categoryRails.length > 0 && (
            <div className="mb-10">
              {categoryRails.map((rail, index) => (
                <div key={rail.category}>
                  {(index > 0 || newOffers.length > 0 || bestsellerOffers.length > 0) && <SectionDivider />}
                  <OfferCardRail
                    id={`cat-rail-${index}`}
                    title={railLabel(rail, t)}
                    glyph={<CategoryIcon category={rail.category} className="h-[18px] w-[18px] flex-shrink-0 text-ink" strokeWidth={1.5} />}
                    offers={rail.offers}
                    href={rail.tile ? categoryHref(rail.tile.category) : undefined}
                    seeAll={rail.tile ? t('cats_see_all').replace('{count}', String(rail.total)) : undefined}
                    showCategoryBadge={false}
                    compact
                    scaled
                    nested
                  />
                </div>
              ))}
            </div>
          )}
        </>
      )}
      </>)}
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
  const fallback = (
    <MemberPageShell fluid contained globalSearch>
      <MemberColumn wide className="pb-28 sm:pb-12">
        <PageHeading />
        <OfferGridSkeleton />
      </MemberColumn>
    </MemberPageShell>
  )
  return (
    <>
      <Navbar />
      <div className="below-header member-canvas">
        <Suspense fallback={fallback}>
          <PerksUrlStateProvider>
            <MemberPageShell fluid contained globalSearch>
              <MemberColumn wide className="pb-28 sm:pb-12">
                <PerksBrowser />
              </MemberColumn>
            </MemberPageShell>
          </PerksUrlStateProvider>
        </Suspense>
      </div>
    </>
  )
}

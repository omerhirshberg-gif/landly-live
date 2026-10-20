import { useCallback, useEffect, useMemo, useState } from 'react'
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, View } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { CATEGORY_TILES, countOffersByCategory, filterCategoryTiles, perksCountLabel } from '@shared/categories'
import { getAllOffers, isOfferAvailable, isOfferNew, sortFeaturedOffers, type OfferDocument } from '@shared/firebase/offers'
import { deriveAreas, localizedName, reverseGeocode, type Area, type Coordinates } from '@shared/geo'
import {
  filterAndSortPerks,
  hasActivePerkFilters,
  normalizeQuery,
  parseCategoryFilter,
  parsePerkSort,
  DEFAULT_PERK_SORT,
  offerDistanceKm,
  sortByNearest,
  type CategoryFilter,
  type PerkSort,
} from '@shared/perks/perksFilter'
import { useDebouncedValue } from '@shared/useDebouncedValue'
import AppText from '../../components/AppText'
import AreaPicker from '../../components/AreaPicker'
import CategoryGrid from '../../components/CategoryGrid'
import NearMeButton from '../../components/NearMeButton'
import Notice from '../../components/Notice'
import OfferCard from '../../components/OfferCard'
import OfferTileRail from '../../components/OfferTileRail'
import PerksCategoryChips from '../../components/PerksCategoryChips'
import PerksSearchField from '../../components/PerksSearchField'
import SortSheet from '../../components/SortSheet'
import WishlistButton from '../../components/WishlistButton'
import { useLang } from '../../i18n/LangProvider'
import { openOffer } from '../../lib/openOffer'
import { API_BASE_URL } from '../../lib/env'
import { colors, type } from '../../theme'

// The searchable catalog: the same offers collection the website reads. With
// nothing chosen it's the overview (web: the /categories overview): the
// search row, the New on Landly and Best Sellers rails (OfferTileRail, real
// perks still claimable only), then the category grid, no filters; a tile
// pushes that category's folder (app/category/[category].tsx).
// A search or a non-default sort opens the listing, and only then do the category chips
// and the Sort chip appear under the search row (web: the /categories filter
// toolbar), both running the shared pipeline in lib/perks/perksFilter.ts. The chip and sort live in the
// route (?cat=…&sort=…), so Home's "See all" can open the tab reset; the
// typed search stays local, as keystrokes don't belong in the route.
export default function PerksScreen() {
  const { t, lang } = useLang()
  const router = useRouter()
  const params = useLocalSearchParams<{ cat?: string; sort?: string }>()
  const category = parseCategoryFilter(params.cat)
  const sort = parsePerkSort(params.sort)
  const [query, setQuery] = useState('')
  // Filters as you type, settled by a short debounce; clearing is instant.
  const debouncedQuery = useDebouncedValue(query, 200)
  const appliedQuery = query ? debouncedQuery : ''
  const [offers, setOffers] = useState<OfferDocument[] | null>(null)
  const [failed, setFailed] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  // Near me (web: /categories): the member's location, or an area picked
  // when there is none. It orders the list nearest-first and shows a Nearby
  // section on the overview; it never leaves the device except rounded to
  // ~1 km for the city name (lib/geo.ts reverseGeocode).
  const [origin, setOrigin] = useState<{ coords: Coordinates; area: Area | null } | null>(null)
  const [geoError, setGeoError] = useState<string | null>(null)
  const [geocodedPlace, setGeocodedPlace] = useState<string | null>(null)
  const originCoords = origin?.coords ?? null

  // Pull-to-refresh reloads; the first load runs in the effect below.
  const load = useCallback(async () => {
    try {
      setOffers(await getAllOffers())
      setFailed(false)
    } catch {
      setFailed(true)
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    getAllOffers()
      .then((next) => {
        if (cancelled) return
        setOffers(next)
        setFailed(false)
      })
      .catch(() => {
        if (!cancelled) setFailed(true)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const onRefresh = async () => {
    setRefreshing(true)
    await load()
    setRefreshing(false)
  }

  const setCategory = (next: CategoryFilter) => router.setParams({ cat: next === 'all' ? '' : next })
  const setSort = (next: PerkSort) => router.setParams({ sort: next === DEFAULT_PERK_SORT ? '' : next })
  // A tile opens its category folder pushed over the tabs, as Home's rail
  // does, so a full-screen swipe (lib/pageFlip.ts) or Android's back turns it
  // back to this grid with the search intact. The chips and Sort below only
  // filter this list in place.
  const openCategory = (next: string) => router.push({ pathname: '/category/[category]', params: { category: next } })

  const normalizedQuery = normalizeQuery(appliedQuery)
  // Nothing chosen: the screen is the category grid.
  const browsing = !hasActivePerkFilters({ query: appliedQuery, category, sort })
  const counts = useMemo(() => (offers ? countOffersByCategory(offers) : null), [offers])
  // A search across All also surfaces the categories it names.
  const matchingTiles = normalizedQuery && category === 'all' ? filterCategoryTiles(CATEGORY_TILES, normalizedQuery, t) : []
  const visible = useMemo(
    () => (browsing || !offers ? [] : filterAndSortPerks(offers, { query: appliedQuery, category, sort }, t, lang, originCoords)),
    // `t` changes identity every render; `lang` covers what it depends on.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [browsing, offers, appliedQuery, category, sort, lang, originCoords]
  )
  // The overview's two rails: sold-out offers left out, bestsellers then newest.
  const railOffers = useMemo(() => (offers ? sortFeaturedOffers(offers.filter(isOfferAvailable)) : []), [offers])
  const newOffers = useMemo(() => railOffers.filter((offer) => isOfferNew(offer.createdAt)), [railOffers])
  const bestsellerOffers = useMemo(() => railOffers.filter((offer) => offer.isBestseller), [railOffers])
  const areas = useMemo(() => deriveAreas(railOffers), [railOffers])
  const nearby = useMemo(
    () => (originCoords ? sortByNearest(railOffers.filter((offer) => offer.geo), originCoords).slice(0, 12) : null),
    [railOffers, originCoords]
  )
  useEffect(() => {
    setGeocodedPlace(null)
    if (!originCoords || origin?.area) return
    let cancelled = false
    reverseGeocode(originCoords, lang, API_BASE_URL).then((city) => {
      if (!cancelled) setGeocodedPlace(city)
    })
    return () => {
      cancelled = true
    }
  }, [originCoords, origin?.area, lang])
  const placeName = origin?.area ? localizedName(origin.area.name, lang) : geocodedPlace
  const selectedTile = CATEGORY_TILES.find((tile) => tile.category === category)
  // The screen title names the selected category (web: the /categories h1),
  // so the results heading only names a search, or "All" for a sort over
  // everything; a category on its own shows just the count.
  const screenTitle = selectedTile ? t(selectedTile.labelKey) : t('mobile_tab_perks')
  const resultsTitle = normalizedQuery
    ? t('cats_search_results_title').replace('{query}', appliedQuery.trim())
    : selectedTile
      ? null
      : t('cats_filter_all')

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <FlatList
        data={visible}
        keyExtractor={(offer) => offer.id}
        renderItem={({ item }) => (
          <OfferCard offer={item} onPress={() => openOffer(item)} showCategoryBadge={category === 'all'} distanceKm={offerDistanceKm(item, originCoords)} />
        )}
        contentContainerStyle={styles.content}
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brand} />}
        ListHeaderComponent={
          <View style={styles.header}>
            <AppText accessibilityRole="header" style={type.screenTitle}>
              {screenTitle}
            </AppText>
            <View style={styles.searchRow}>
              <PerksSearchField value={query} onChangeText={setQuery} />
              <NearMeButton
                active={!!origin}
                onLocate={(coords) => setOrigin({ coords, area: null })}
                onClear={() => setOrigin(null)}
                onError={setGeoError}
              />
              <WishlistButton />
            </View>
            {geoError && !origin && (
              <View style={styles.geoNotice}>
                <AppText accessibilityLiveRegion="polite" style={styles.geoError}>
                  {geoError}
                </AppText>
                {areas.length > 0 && (
                  <AreaPicker
                    areas={areas}
                    onPick={(area) => {
                      setGeoError(null)
                      setOrigin({ coords: area.center, area })
                    }}
                  />
                )}
              </View>
            )}

            {/* Listing only. Chips scroll out from under the start edge; Sort stays
                pinned at the end, past a hairline divider. */}
            {!browsing && (
              <View style={styles.filterRow}>
                <PerksCategoryChips value={category} onChange={setCategory} style={styles.chips} />
                <View style={styles.filterDivider} />
                <SortSheet value={sort} onChange={setSort} />
              </View>
            )}

            {failed && <Notice message={t('mobile_load_error')} />}

            {browsing && nearby && (
              <View style={styles.nearby} accessibilityLiveRegion="polite">
                <AppText accessibilityRole="header" style={styles.sectionTitle}>
                  {t('discover_nearby_title')}
                </AppText>
                {!!placeName && (
                  <AppText style={styles.nearbyPlace}>{t('discover_nearby_place').replace('{place}', `\u2068${placeName}\u2069`)}</AppText>
                )}
                {nearby.length === 0 ? (
                  <View style={styles.nearbyEmpty}>
                    <AppText style={styles.emptyTitle}>{t('geo_nearby_empty_title')}</AppText>
                    <AppText style={styles.emptySub}>{t('geo_nearby_empty_sub')}</AppText>
                  </View>
                ) : (
                  nearby.map((offer) => (
                    <OfferCard key={offer.id} offer={offer} onPress={() => openOffer(offer)} distanceKm={offerDistanceKm(offer, originCoords)} />
                  ))
                )}
              </View>
            )}

            {browsing && (
              <>
                {(newOffers.length > 0 || bestsellerOffers.length > 0) && (
                  <View style={styles.rails}>
                    {newOffers.length > 0 && <OfferTileRail emoji="✨" title={t('row_new')} offers={newOffers} onOpen={openOffer} />}
                    {bestsellerOffers.length > 0 && (
                      <OfferTileRail emoji="🔥" title={t('row_bestsellers')} offers={bestsellerOffers} onOpen={openOffer} />
                    )}
                  </View>
                )}
                <AppText accessibilityRole="header" style={styles.sectionTitle}>
                  {t('cats_all_categories_title')}
                </AppText>
                <CategoryGrid tiles={CATEGORY_TILES} counts={counts} onSelect={openCategory} />
              </>
            )}

            {matchingTiles.length > 0 && (
              <>
                <AppText accessibilityRole="header" style={styles.sectionTitle}>
                  {t('cats_matching_categories')}
                </AppText>
                <CategoryGrid tiles={matchingTiles} counts={counts} onSelect={openCategory} />
              </>
            )}

            {!browsing && visible.length > 0 && (
              <View style={styles.resultsHeading} accessibilityLiveRegion="polite">
                {resultsTitle && (
                  <AppText accessibilityRole="header" style={styles.sectionTitle}>
                    {resultsTitle}
                  </AppText>
                )}
                <AppText style={styles.resultsCount}>{perksCountLabel(visible.length, t)}</AppText>
              </View>
            )}
          </View>
        }
        ListEmptyComponent={
          browsing ? null : offers === null ? (
            failed ? null : <ActivityIndicator color={colors.brand} style={styles.spinner} />
          ) : matchingTiles.length > 0 ? null : (
            <View style={styles.empty} accessibilityLiveRegion="polite">
              <AppText style={styles.emptyTitle}>
                {normalizedQuery ? t('cats_search_no_results_sub') : t('deals_empty_title')}
              </AppText>
              {!normalizedQuery && <AppText style={styles.emptySub}>{t('deals_empty_sub')}</AppText>}
            </View>
          )
        }
      />
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 24, flexGrow: 1 },
  header: { marginBottom: 16, gap: 14 },
  // Search, Near Me and the wishlist heart share one 44pt row; the two 44pt
  // icon squares sit at the reading-direction end and the field takes the rest.
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  geoNotice: { marginTop: -6, gap: 10 },
  geoError: { fontSize: 13, lineHeight: 18, fontWeight: '600', color: colors.danger },
  nearby: { gap: 4 },
  nearbyPlace: { fontSize: 14, lineHeight: 20, color: colors.body, marginBottom: 8 },
  nearbyEmpty: { alignItems: 'center', paddingVertical: 24, paddingHorizontal: 16 },
  filterRow: { flexDirection: 'row', alignItems: 'center' },
  // Bleed to the start edge only; the rail's own end padding is the gap before the divider.
  chips: { flex: 1, minWidth: 0, marginHorizontal: 0, marginStart: -16 },
  rails: { gap: 16, marginTop: 4 },
  filterDivider: { width: 1, height: 24, flexShrink: 0, marginEnd: 12, backgroundColor: colors.border },
  sectionTitle: { fontSize: 17, lineHeight: 24, fontWeight: '700', color: colors.heading, marginTop: 4 },
  resultsHeading: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline', columnGap: 8 },
  resultsCount: { fontSize: 14, color: colors.textMuted },
  spinner: { marginTop: 48 },
  empty: { alignItems: 'center', marginTop: 48, paddingHorizontal: 24 },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: colors.heading, textAlign: 'center', marginBottom: 4 },
  emptySub: { fontSize: 14, color: colors.body, textAlign: 'center' },
})

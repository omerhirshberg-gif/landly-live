import TabHeader from '../../components/TabHeader'
import CategoryOfferRail from '../../components/CategoryOfferRail'
import { startTransition, useCallback, useDeferredValue, useMemo, useState } from 'react'
import { Pressable, RefreshControl, StyleSheet, View, type ViewToken } from 'react-native'
import { FlashList } from '@shopify/flash-list'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { CATEGORY_TILES, filterCategoryTiles } from '@shared/categories'
import { isOfferAvailable, isOfferNew, sortFeaturedOffers, type OfferDocument } from '@shared/firebase/offers'
import { useOffers } from '@shared/offers/useOffers'
import {
  filterAndSortPerks,
  hasActivePerkFilters,
  normalizeQuery,
  parseCategoryFilter,
  parsePerkSort,
  DEFAULT_PERK_SORT,
  type CategoryFilter,
  type PerkSort,
} from '@shared/perks/perksFilter'
import AppText from '../../components/AppText'
import LocationFilterBar from '../../components/LocationFilterBar'
import CategoryGrid from '../../components/CategoryGrid'
import LiveChainsSection from '../../components/LiveChainsSection'
import PerksSoonCard from '../../components/PerksSoonCard'
import RaayonitReferralCard from '../../components/RaayonitReferralCard'
import { matchRaayonitChains } from '@shared/perks/raayonitReferral'
import FeedCell from '../../components/FeedCell'
import SortSheet from '../../components/SortSheet'
import FilterSheet, { type FilterFacets, type FilterValues } from '../../components/FilterSheet'
import { OFFER_KINDS, offerKind, type OfferKind } from '@shared/offers/offerKind'
import { applyLocationFilterWithNationwide, badgeKm, partitionByLocation, sortByLocation } from '@shared/perks/locationFilter'
import NearMeButton from '../../components/NearMeButton'
import { useLocationFilter } from '../../lib/useLocationFilter'
import Notice from '../../components/Notice'
import OfferCard from '../../components/OfferCard'
import OfferTileRail from '../../components/OfferTileRail'
import { buildCategoryRails, isSuperVoucher, type CategoryRailGroup } from '@shared/home/categoryRails'
import PerksCategoryChips from '../../components/PerksCategoryChips'
import PerksSearchField from '../../components/PerksSearchField'
import ScreenTitleRow from '../../components/ScreenTitleRow'
import SectionDivider from '../../components/SectionDivider'
import { OfferListSkeleton } from '../../components/Skeleton'
import { useLang } from '../../i18n/LangProvider'
import { locationCountLabel } from '@shared/perks/locationCount'
import { openOffer } from '../../lib/openOffer'
import { isFlagship, isRaayonitOffer, landlyOffers } from '@shared/offers/discoverTab'
import { selectChainsPreview } from '@shared/home/chainsPreview'
import { useRaayonitDisplay } from '@shared/flags/raayonitDisplayStore'
import { useLayout } from '../../lib/useLayout'
import { colors, header } from '../../theme'

// The searchable catalog: the same offers collection the website reads. With
// nothing chosen it's the overview (web: the /categories overview): the
// search row, the New on GoLandly and Best Sellers rails (OfferTileRail, real
// perks still claimable only), then the category grid, no filters; a tile
// pushes that category's folder (app/category/[category].tsx).
// A search or a non-default sort opens the listing, and only then do the category chips
// and the Sort chip appear under the search row (web: the /categories filter
// toolbar), both running the shared pipeline in lib/perks/perksFilter.ts. The chip and sort live in the
// route (?cat=…&sort=…), so Home's "See all" can open the tab reset; the
// typed search stays local, as keystrokes don't belong in the route.
// Rows of the Perks list. The overview (showcase, the New / Best Sellers rails,
// a rail per category) and the listing's results are list rows, not the list
// header, so FlashList mounts only those near the viewport and typing in the
// search never re-renders a rail scrolled out of sight.
type PerksRow =
  | { key: 'landlyLabel'; type: 'landlyLabel' }
  | { key: 'highlights'; type: 'highlights'; divider: boolean }
  | { key: string; type: 'rail'; rail: CategoryRailGroup; divider: boolean }
  | { key: 'tiles'; type: 'tiles' }
  | { key: 'heading'; type: 'heading' }
  | { key: 'nationwide'; type: 'nationwide' }
  | { key: string; type: 'offer'; offer: OfferDocument; index: number; nationwide?: boolean }
  | { key: 'empty'; type: 'empty' }
  | { key: 'referral'; type: 'referral' }
  | { key: 'soon'; type: 'soon' }
  | { key: 'browse'; type: 'browse' }
  | { key: 'live'; type: 'live' }

const VIEWABILITY = { itemVisiblePercentThreshold: 5 }
const rowKey = (row: PerksRow) => row.key
const rowType = (row: PerksRow) => row.type

export default function PerksScreen() {
  const { t, lang, isRtl } = useLang()
  const router = useRouter()
  // One card per row on a phone, two unfolded, three on a tablet.
  const { columns, cellWidth, paddingLeft, paddingRight } = useLayout()
  const params = useLocalSearchParams<{ cat?: string; sort?: string; focus?: string; kind?: string; brand?: string; src?: string }>()
  // The chip and the sort live in the route; a pick shows on the tap's frame (held here until the route catches up).
  const routeCategory = parseCategoryFilter(params.cat)
  const routeSort = parsePerkSort(params.sort)
  // Each pick remembers the route value it was made over; once the route moves on, the route wins again.
  const [pickedCategory, setPickedCategory] = useState<{ value: CategoryFilter; over: CategoryFilter } | null>(null)
  const [pickedSort, setPickedSort] = useState<{ value: PerkSort; over: PerkSort } | null>(null)
  const category = pickedCategory && pickedCategory.over === routeCategory ? pickedCategory.value : routeCategory
  const sort = pickedSort && pickedSort.over === routeSort ? pickedSort.value : routeSort
  // Offer type and brand live in the route as well (the brand spotlight's "To brand page" opens ?brand=…).
  const kind: OfferKind | 'all' = (OFFER_KINDS as readonly string[]).includes(params.kind ?? '') ? (params.kind as OfferKind) : 'all'
  const brand = typeof params.brand === 'string' ? params.brand.trim() : ''
  const [query, setQuery] = useState('')
  // The field, the chips and Sort update at once; the catalog is filtered against these deferred copies, in the background.
  const deferredQuery = useDeferredValue(query)
  const appliedQuery = query ? deferredQuery : ''
  const listCategory = useDeferredValue(category)
  const listSort = useDeferredValue(sort)
  const { offers: allOffers, failed, refresh } = useOffers()
  // Explore Perks is GoLandly's own perks only; Raayonit's "תו על" has its own tab.
  const offers = useMemo(() => (allOffers ? landlyOffers(allOffers) : null), [allOffers])
  const landlyEmpty = offers !== null && offers.length === 0
  // While GoLandly has no direct perks the screen points at the Raayonit Card tab: its entry strip and a preview of its chains (the name follows the display flag).
  const showRaayonit = useRaayonitDisplay()
  const raayonitOffers = useMemo(() => (allOffers ?? []).filter(isRaayonitOffer), [allOffers])
  const chainCount = useMemo(() => raayonitOffers.filter((o) => !isFlagship(o)).length, [raayonitOffers])
  const chainsPreview = useMemo(() => selectChainsPreview(raayonitOffers, lang), [raayonitOffers, lang])
  const [refreshing, setRefreshing] = useState(false)
  // Near me / a picked area (lib/perks/locationFilter.ts): one filter shared with Home and the category screens
  // (lib/useLocationFilter.ts). It narrows every list below, and nationwide chains that can't be placed are kept, listed apart.
  const location = useLocationFilter()
  const loc = location.filter
  const located = useMemo(() => (offers ? applyLocationFilterWithNationwide(offers, loc) : null), [offers, loc])
  // Nothing real in this radius or area: only multi-chain passes and unplaceable nationwide chains are left.
  const locEmpty = !!loc && !!offers && !partitionByLocation(offers, loc).nearby.some((o) => o.perkScope !== 'multi_chain')

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    await refresh()
    setRefreshing(false)
  }, [refresh])

  const setCategory = (next: CategoryFilter) => {
    setPickedCategory({ value: next, over: routeCategory })
    startTransition(() => router.setParams({ cat: next === 'all' ? '' : next }))
  }
  // A tile opens its category folder pushed over the tabs, as Home's rail
  // does, so a full-screen swipe (lib/pageFlip.ts) or Android's back turns it
  // back to this grid with the search intact. The chips and Sort below only
  // filter this list in place.
  const openCategory = useCallback((next: string) => router.push({ pathname: '/category/[category]', params: { category: next } }), [router])

  const normalizedQuery = normalizeQuery(appliedQuery)
  // A search that names a business honouring the Raayonit Card (only while it has no direct perk to show, see the rows below).
  const referralMatches = useMemo(() => (showRaayonit && normalizedQuery ? matchRaayonitChains(raayonitOffers, appliedQuery) : []), [showRaayonit, normalizedQuery, raayonitOffers, appliedQuery])
  // Nothing chosen: the screen is the overview.
  const browsing = !hasActivePerkFilters({ query, category, sort, kind, brand })
  const listBrowsing = !hasActivePerkFilters({ query: appliedQuery, category: listCategory, sort: listSort, kind, brand })
  // A search across All also surfaces the categories it names.
  const matchingTiles = useMemo(
    () => (normalizedQuery && listCategory === 'all' ? filterCategoryTiles(CATEGORY_TILES, normalizedQuery, t) : []),
    [normalizedQuery, listCategory, t]
  )
  const { nearbyList, nationwideList } = useMemo(() => {
    if (listBrowsing || !offers) return { nearbyList: [] as OfferDocument[], nationwideList: [] as OfferDocument[] }
    const matched = filterAndSortPerks(offers, { query: appliedQuery, category: listCategory, sort: listSort, kind, brand }, t, lang, null)
    const parts = partitionByLocation(matched, loc)
    return { nearbyList: sortByLocation(parts.nearby, listSort === DEFAULT_PERK_SORT ? loc : null), nationwideList: parts.nationwide }
  }, [listBrowsing, offers, appliedQuery, listCategory, listSort, kind, brand, t, lang, loc])
  const visible = useMemo(() => [...nearbyList, ...nationwideList], [nearbyList, nationwideList])
  // What the filter sheet can narrow by, with how many perks each choice leaves.
  const facets = useMemo<FilterFacets>(() => {
    const kinds: Record<OfferKind, number> = { voucher: 0, discount: 0, deal: 0 }
    const cats = new Map<string, number>()
    for (const offer of offers ?? []) {
      kinds[offerKind(offer)] += 1
      cats.set(offer.category, (cats.get(offer.category) ?? 0) + 1)
    }
    return {
      kinds,
      categories: CATEGORY_TILES.filter((tile) => cats.has(tile.category)).map((tile) => ({ key: tile.category as CategoryFilter, label: t(tile.labelKey), count: cats.get(tile.category) ?? 0 })),
    }
  }, [offers, t])
  const applyFilters = (next: FilterValues) => {
    setPickedCategory({ value: next.category, over: routeCategory })
    setPickedSort({ value: next.sort, over: routeSort })
    startTransition(() => router.setParams({ cat: next.category === 'all' ? '' : next.category, sort: next.sort === DEFAULT_PERK_SORT ? '' : next.sort, kind: next.kind === 'all' ? '' : next.kind, brand: next.brand }))
  }
  // The overview's two rails: sold-out offers left out, bestsellers then newest.
  const railOffers = useMemo(() => (located ? sortFeaturedOffers(located.filter((offer) => isOfferAvailable(offer) && !isSuperVoucher(offer))) : []), [located])
  const categoryRails = useMemo(() => (located ? buildCategoryRails(located) : []), [located])
  const newOffers = useMemo(() => railOffers.filter((offer) => isOfferNew(offer.createdAt) && offer.fulfillmentType !== 'raayonit_pool'), [railOffers])
  const bestsellerOffers = useMemo(() => railOffers.filter((offer) => offer.isBestseller), [railOffers])
  const selectedTile = CATEGORY_TILES.find((tile) => tile.category === category)
  // The screen title names the selected category (web: the /categories h1),
  // so the results heading only names a search, or "All" for a sort over
  // everything; a category on its own shows just the count.
  const screenTitle = selectedTile ? t(selectedTile.labelKey) : t('perks_explore_title')
  const listTile = CATEGORY_TILES.find((tile) => tile.category === listCategory)
  const resultsTitle = normalizedQuery
    ? t('cats_search_results_title').replace('{query}', appliedQuery.trim())
    : listTile
      ? null
      : t('cats_filter_all')

  const rows = useMemo<PerksRow[]>(() => {
    const list: PerksRow[] = []
    // Explore Perks is GoLandly's own perks: the direct perks, or a calm note while there are none. A search or a filter narrows them alone.
    if (landlyEmpty) {
      // A search still names the categories it matches (there is nothing else to filter).
      if (normalizedQuery) {
        const refRow: PerksRow[] = referralMatches.length > 0 ? [{ key: 'referral', type: 'referral' }] : []
        if (matchingTiles.length > 0) return [{ key: 'tiles', type: 'tiles' }, ...refRow]
        return refRow.length > 0 ? refRow : [{ key: 'empty', type: 'empty' }]
      }
      // The live Raayonit chains lead (they work today), then the quiet "on their way" note and the categories to browse.
      if (showRaayonit && chainsPreview.length > 0) list.push({ key: 'live', type: 'live' })
      list.push({ key: 'soon', type: 'soon' }, { key: 'browse', type: 'browse' })
      return list
    }
    if (listBrowsing) {
      const highlights = newOffers.length > 0 || bestsellerOffers.length > 0
      if (highlights || categoryRails.length > 0) list.push({ key: 'landlyLabel', type: 'landlyLabel' })
      if (highlights) list.push({ key: 'highlights', type: 'highlights', divider: false })
      categoryRails.forEach((rail, index) => list.push({ key: `c:${rail.category}`, type: 'rail', rail, divider: index > 0 || highlights }))
      return list
    }
    if (matchingTiles.length > 0) list.push({ key: 'tiles', type: 'tiles' })
    if (visible.length > 0) {
      list.push({ key: 'heading', type: 'heading' })
      nearbyList.forEach((offer, index) => list.push({ key: `o:${offer.id}`, type: 'offer', offer, index }))
      if (nationwideList.length > 0) list.push({ key: 'nationwide', type: 'nationwide' })
      nationwideList.forEach((offer, index) => list.push({ key: `o:${offer.id}`, type: 'offer', offer, index, nationwide: true }))
    } else if (referralMatches.length > 0) {
      list.push({ key: 'referral', type: 'referral' })
    } else if (offers !== null && matchingTiles.length === 0) {
      list.push({ key: 'empty', type: 'empty' })
    }
    return list
  }, [landlyEmpty, normalizedQuery, showRaayonit, chainsPreview, listBrowsing, newOffers, bestsellerOffers, categoryRails, matchingTiles, visible, nearbyList, nationwideList, offers, referralMatches])

  // Which rows are on screen: a rail's autoplay runs only while it is.
  const [visibleKeys, setVisibleKeys] = useState<ReadonlySet<string>>(() => new Set(['highlights']))
  const onViewableItemsChanged = useCallback(({ viewableItems }: { viewableItems: ViewToken<PerksRow>[] }) => {
    const next = new Set(viewableItems.map((v) => v.key))
    setVisibleKeys((prev) => (prev.size === next.size && [...next].every((k) => prev.has(k)) ? prev : next))
  }, [])

  const showBadge = listCategory === 'all'
  const cardWidth = columns > 1 ? cellWidth : undefined
  const renderRow = ({ item }: { item: PerksRow }) => {
    switch (item.type) {
      case 'landlyLabel':
        return <AppText style={styles.landlyLabel}>{t('perks_landly_label')}</AppText>
      case 'highlights':
        return (
          <>
            {item.divider && <SectionDivider />}
            <View style={styles.rails}>
              {newOffers.length > 0 && <OfferTileRail glyph="new" title={t('row_new')} offers={newOffers} onOpen={openOffer} autoAdvance visible={visibleKeys.has('highlights')} />}
              {newOffers.length > 0 && bestsellerOffers.length > 0 && <SectionDivider />}
              {bestsellerOffers.length > 0 && (
                <OfferTileRail glyph="bestsellers" title={t('row_bestsellers')} offers={bestsellerOffers} onOpen={openOffer} autoAdvance autoAdvanceOffsetMs={2000} visible={visibleKeys.has('highlights')} />
              )}
            </View>
          </>
        )
      case 'rail':
        // One rail per category that holds a claimable perk, each with "See all (N)" to its full list.
        // Keyed by category: a recycled row remounts its rail, so one rail's scroll position never shows on another.
        return (
          <View>
            {item.divider && <SectionDivider />}
            <CategoryOfferRail key={item.rail.category} rail={item.rail} withCount onSeeAll={item.rail.tile ? openCategory : undefined} visible={visibleKeys.has(item.key)} />
          </View>
        )
      case 'tiles':
        return (
          <View style={styles.block}>
            <AppText accessibilityRole="header" style={styles.sectionTitle}>
              {t('cats_matching_categories')}
            </AppText>
            <CategoryGrid tiles={matchingTiles} onSelect={openCategory} />
          </View>
        )
      case 'heading':
        return (
          <View style={[styles.resultsHeading, styles.block]} accessibilityLiveRegion="polite">
            {resultsTitle && (
              <AppText accessibilityRole="header" style={styles.sectionTitle}>
                {resultsTitle}
              </AppText>
            )}
            <AppText style={styles.resultsCount}>{locationCountLabel(nearbyList.length, nationwideList.length, t)}</AppText>
          </View>
        )
      case 'nationwide':
        return (
          <View style={styles.block}>
            <AppText accessibilityRole="header" style={styles.sectionTitle}>{t('loc_more_nationwide')}</AppText>
          </View>
        )
      case 'offer':
        return (
          <FeedCell column={item.index}>
            <OfferCard offer={item.offer} onOpen={openOffer} showCategoryBadge={showBadge} distanceKm={badgeKm(item.offer, loc)} nationwide={item.nationwide} width={cardWidth} />
          </FeedCell>
        )
      case 'soon':
        return <PerksSoonCard quiet={showRaayonit && chainsPreview.length > 0} />
      case 'browse':
        return (
          <View style={styles.browse}>
            <AppText accessibilityRole="header" style={styles.sectionTitle}>{t('perks_browse_title')}</AppText>
            <CategoryGrid tiles={CATEGORY_TILES} onSelect={openCategory} />
          </View>
        )
      case 'live':
        return <LiveChainsSection offers={chainsPreview} chainCount={chainCount} />
      case 'referral':
        return <RaayonitReferralCard matches={referralMatches} query={appliedQuery} chainCount={chainCount} />
      case 'empty':
        return (
          <View style={styles.empty} accessibilityLiveRegion="polite">
            <AppText style={styles.emptyTitle}>{normalizedQuery ? t('cats_search_no_results_sub') : t('deals_empty_title')}</AppText>
            {!normalizedQuery && <AppText style={styles.emptySub}>{t('deals_empty_sub')}</AppText>}
          </View>
        )
    }
  }

  // The header holds only the title, search and filters, so a keystroke re-renders just these and the rows whose data changed.
  const listHeader = (
    <View style={styles.header}>
      <ScreenTitleRow title={screenTitle} />
      <View style={styles.searchRow}>
        <PerksSearchField value={query} onChangeText={setQuery} autoFocus={params.focus === '1'} />
        {!landlyEmpty && <NearMeButton filter={loc} onApply={location.apply} />}
        {!landlyEmpty && <FilterSheet values={{ sort, kind, category, brand }} onApply={applyFilters} facets={facets} />}
      </View>
      {!landlyEmpty && <LocationFilterBar
        filter={loc}
        onRadius={location.setRadiusKm}
        onClear={location.clear}
      />}
      {!landlyEmpty && locEmpty && (
        <View style={styles.nearbyEmpty} accessibilityLiveRegion="polite">
          <AppText style={styles.emptyTitle}>{t('loc_empty_title').replace('{km}', String(loc?.kind === 'gps' ? loc.radiusKm : ''))}</AppText>
          <AppText style={styles.emptySub}>{t('loc_empty_sub')}</AppText>
          {loc?.kind === 'gps' && loc.radiusKm < 25 && (
            <Pressable accessibilityRole="button" onPress={() => location.setRadiusKm(loc.radiusKm === 5 ? 15 : 25)} style={styles.expand}>
              <AppText style={styles.expandText}>{t('loc_expand').replace('{km}', String(loc.radiusKm === 5 ? 15 : 25))}</AppText>
            </Pressable>
          )}
        </View>
      )}

      {/* Chips (listing only) scroll out from under the start edge; Sort is always there, pinned at the end. */}
      {!landlyEmpty && (
        <View style={[styles.filterRow, browsing && styles.filterRowEnd]}>
          {!browsing && <PerksCategoryChips value={category} onChange={setCategory} style={[styles.chips, { marginStart: -(isRtl ? paddingRight : paddingLeft) }]} />}
          <SortSheet value={sort} onChange={(next) => applyFilters({ sort: next, kind, category, brand })} />
        </View>
      )}

      {failed && <Notice message={t('mobile_load_error')} />}
    </View>
  )

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <TabHeader />
      <FlashList
        data={rows}
        renderItem={renderRow}
        keyExtractor={rowKey}
        getItemType={rowType}
        numColumns={columns}
        key={'cols-' + columns}
        // Everything but a perk card spans the whole row.
        overrideItemLayout={(layout, item) => {
          layout.span = item.type === 'offer' ? 1 : columns
        }}
        extraData={visibleKeys}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={VIEWABILITY}
        ListHeaderComponent={listHeader}
        ListEmptyComponent={!listBrowsing && offers === null && !failed ? <OfferListSkeleton /> : null}
        showsVerticalScrollIndicator={false}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={[styles.content, { paddingLeft, paddingRight }]}
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brand} />}
      />
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: 16, paddingTop: header.top, paddingBottom: 110, flexGrow: 1 },
  // The title row, search and filters as one group (14 apart), then header.gap before the results.
  header: { marginBottom: header.gap, gap: 14 },
  // Search and Near Me share one 44pt row; the 44pt Near Me square sits at the
  // reading-direction end and the field takes the rest.
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  geoNotice: { marginTop: -6, gap: 10 },
  expand: { alignSelf: 'flex-start', minHeight: 44, justifyContent: 'center' },
  expandText: { fontSize: 14, fontWeight: '700', color: colors.brand },
  geoError: { fontSize: 13, lineHeight: 18, fontWeight: '600', color: colors.danger },
  nearbyEmpty: { alignItems: 'center', paddingVertical: 24, paddingHorizontal: 16 },
  filterRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  filterRowEnd: { justifyContent: 'flex-end' },
  // Bleed to the start edge only (by that side's padding, set inline: the right in Hebrew); the rail's own end padding is the gap before the divider.
  chips: { flex: 1, minWidth: 0, marginEnd: 0 },
  rails: { gap: 16, marginTop: 4 },
  channelTitle: { fontSize: 22, fontWeight: '800', letterSpacing: -0.5, color: colors.heading, marginBottom: 14 },
  landlyLabel: { fontSize: 12, lineHeight: 16, fontWeight: '700', letterSpacing: 0.4, color: colors.brand, marginBottom: 6 },
  // A row after the header keeps the header's 14pt rhythm.
  block: { marginBottom: 14 },
  filterDivider: { width: 1, height: 24, flexShrink: 0, marginEnd: 12, backgroundColor: colors.border },
  sectionTitle: { fontSize: 17, lineHeight: 24, fontWeight: '700', color: colors.heading, marginTop: 4 },
  resultsHeading: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline', columnGap: 8 },
  resultsCount: { fontSize: 14, color: colors.textMuted },
  browse: { marginTop: 28, gap: 14 },
  empty: { alignItems: 'center', marginTop: 48, paddingHorizontal: 24 },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: colors.heading, textAlign: 'center', marginBottom: 4 },
  emptySub: { fontSize: 14, color: colors.body, textAlign: 'center' },
})

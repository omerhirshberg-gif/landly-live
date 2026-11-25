import { useCallback, useDeferredValue, useMemo, useState } from 'react'
import { Platform, Pressable, RefreshControl, Share, StyleSheet, View } from 'react-native'
import { FlashList } from '@shopify/flash-list'
import { router, useLocalSearchParams } from 'expo-router'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
import { CATEGORY_TILES, perksCountLabel } from '@shared/categories'
import type { OfferDocument } from '@shared/firebase/offers'
import { useOffers } from '@shared/offers/useOffers'
import { landlyOffers } from '@shared/offers/discoverTab'
import { DEFAULT_PERK_SORT, filterAndSortPerks, parseCategoryFilter, type PerkSort } from '@shared/perks/perksFilter'
import { badgeKm, partitionByLocation, sortByLocation } from '@shared/perks/locationFilter'
import { locationCountLabel } from '@shared/perks/locationCount'
import AppText from '../../components/AppText'
import LocationFilterBar from '../../components/LocationFilterBar'
import NearMeButton from '../../components/NearMeButton'
import FeedCell from '../../components/FeedCell'
import GlassBackButton from '../../components/GlassBackButton'
import Notice from '../../components/Notice'
import OfferCard from '../../components/OfferCard'
import PerksSearchField from '../../components/PerksSearchField'
import SortSheet from '../../components/SortSheet'
import { OfferListSkeleton } from '../../components/Skeleton'
import { useLang } from '../../i18n/LangProvider'
import { useLocationFilter } from '../../lib/useLocationFilter'
import { openOffer } from '../../lib/openOffer'
import { useLayout } from '../../lib/useLayout'
import { gridCellWidth } from '../../lib/layout'
import { API_BASE_URL } from '../../lib/env'
import LineIcon from '../../components/LineIcon'
import { colors, radius, type } from '../../theme'
import CategoryIcon from '../../components/CategoryIcon'
import CategoryEmptyState from '../../components/CategoryEmptyState'

// A category "folder" (web: /categories/[category]), pushed over the tabs
// from the Perks grid or Home's category rail as a page flip
// (lib/pageFlip.ts): a full-screen swipe in the reading direction turns it
// back to where it was opened, the same as the back button. Search and Sort
// work within the category, through the same pipeline as the Perks tab.
export default function CategoryScreen() {
  const { t, lang } = useLang()
  // Columns follow the window (two unfolded, three on a tablet); the key
  // remounts the list when folding changes them, as numColumns requires.
  // Two equal-height cards per row on a phone (three unfolded, four on a tablet).
  const { categoryColumns: columns, rowWidth, paddingLeft, paddingRight } = useLayout()
  const cellWidth = gridCellWidth(rowWidth, columns)
  const grid = useMemo(() => ({ columns, cellWidth }), [columns, cellWidth])
  // The back bar sits outside the list, so it steps in from a side cutout itself.
  const insets = useSafeAreaInsets()
  const { category: rawCategory } = useLocalSearchParams<{ category: string }>()
  // Canonical name for any spelling of a known category (`Beach+and+Sea`
  // arrives undecoded), so the tile and the Firestore query both match.
  const parsedCategory = parseCategoryFilter(rawCategory)
  const category = parsedCategory === 'all' ? (rawCategory ?? '') : parsedCategory
  const tile = CATEGORY_TILES.find((c) => c.category === category)
  // This category's slice of the shared catalog (lib/offers/offersStore.ts), drawn from the held copy on the first frame.
  const { offers: catalog, failed, refresh } = useOffers()
  const offers = useMemo(() => (catalog ? landlyOffers(catalog).filter((offer) => offer.category === category) : null), [catalog, category])
  const [refreshing, setRefreshing] = useState(false)
  const [query, setQuery] = useState('')
  // The field updates on the keystroke's frame; the list filters against the deferred copy; clearing is instant.
  const deferredQuery = useDeferredValue(query)
  const appliedQuery = query ? deferredQuery : ''
  const [sort, setSort] = useState<PerkSort>(DEFAULT_PERK_SORT)
  // Near me / a picked area: the app-wide location filter (lib/useLocationFilter.ts), so a radius or area set on Home or
  // Perks is already applied when "See all (N)" opens this category. The list narrows to it, and nationwide chains that
  // can't be placed follow in their own section.
  const location = useLocationFilter()
  const loc = location.filter

  // Already one category, so the pipeline only searches and sorts; the location then splits nearby from nationwide.
  const { nearbyList, nationwideList } = useMemo(() => {
    if (!offers) return { nearbyList: [] as OfferDocument[], nationwideList: [] as OfferDocument[] }
    const matched = filterAndSortPerks(offers, { query: appliedQuery, category: 'all', sort }, t, lang, null)
    const parts = partitionByLocation(matched, loc)
    return { nearbyList: sortByLocation(parts.nearby, sort === DEFAULT_PERK_SORT ? loc : null), nationwideList: parts.nationwide }
  }, [offers, appliedQuery, sort, t, lang, loc])
  const visible = useMemo(() => [...nearbyList, ...nationwideList], [nearbyList, nationwideList])
  const nearbyCount = nearbyList.length
  const rows = useMemo<CategoryRow[]>(() => {
    const list: CategoryRow[] = nearbyList.map((offer) => ({ key: offer.id, type: 'offer', offer }))
    if (nationwideList.length > 0) list.push({ key: 'nationwide-heading', type: 'nationwide' })
    nationwideList.forEach((offer) => list.push({ key: offer.id, type: 'offer', offer, nationwide: true }))
    return list
  }, [nearbyList, nationwideList])

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    await refresh()
    setRefreshing(false)
  }, [refresh])
  const cardWidth = columns > 1 ? cellWidth : undefined
  const renderItem = useCallback(
    ({ item, index }: { item: CategoryRow; index: number }) =>
      item.type === 'nationwide' ? (
        <AppText accessibilityRole="header" style={styles.nationwideTitle}>{t('loc_more_nationwide')}</AppText>
      ) : (
        <FeedCell column={index} grid={grid}>
          <OfferCard offer={item.offer} variant={columns > 1 ? 'compact' : 'standard'} onOpen={openOffer} showCategoryBadge={false} distanceKm={badgeKm(item.offer, loc)} nationwide={item.nationwide} width={cardWidth} />
        </FeedCell>
      ),
    [loc, cardWidth, grid, columns, t]
  )
  // "Share with a friend": this category's page on the website, through the system share sheet.
  const shareCategory = () => {
    const url = `${API_BASE_URL}/categories?cat=${encodeURIComponent(category)}`
    Share.share(Platform.OS === 'ios' ? { url } : { message: url }).catch(() => {})
  }

  // Opened from a deep link with nothing under it: back lands on the grid.
  const goBack = () => {
    if (router.canGoBack()) router.back()
    else router.replace('/perks')
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={[styles.bar, { paddingLeft: insets.left + 8, paddingRight: insets.right + 8 }]}>
        <GlassBackButton label={t('cats_detail_back')} onPress={goBack} />
      </View>
      <FlashList
        showsVerticalScrollIndicator={false}
        showsHorizontalScrollIndicator={false}
        key={'cols-' + columns}
        data={rows}
        keyExtractor={rowKey}
        getItemType={rowType}
        overrideItemLayout={(layout, item) => { layout.span = item.type === 'nationwide' ? columns : 1 }}
        numColumns={columns}
        renderItem={renderItem}
        contentContainerStyle={[styles.content, { paddingLeft, paddingRight }]}
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brand} />}
        ListHeaderComponent={
          <View style={styles.header}>
            <View style={styles.titleRow}>
              <View style={styles.emojiBox}>
                <CategoryIcon category={category} size={24} color={colors.textStrong} strokeWidth={1.5} />
              </View>
              <View style={styles.titleText}>
                <AppText accessibilityRole="header" style={type.screenTitle}>
                  {tile ? t(tile.labelKey) : category}
                </AppText>
                {offers ? (
                  <AppText style={styles.count}>{loc ? locationCountLabel(nearbyCount, nationwideList.length, t) : perksCountLabel(offers.length, t)}</AppText>
                ) : (
                  !failed && <View style={styles.countPlaceholder} />
                )}
              </View>
            </View>
            {!!offers?.length && (
              <View style={styles.controls}>
                <PerksSearchField value={query} onChangeText={setQuery} />
                <NearMeButton filter={loc} onApply={location.apply} />
                <SortSheet value={sort} onChange={setSort} />
              </View>
            )}
            <LocationFilterBar filter={loc} onRadius={location.setRadiusKm} onClear={location.clear} />
            {failed && <Notice message={t('mobile_load_error')} />}
          </View>
        }
        ListFooterComponent={
          visible.length > 0 ? (
            <Pressable accessibilityRole="button" onPress={shareCategory} style={({ pressed }) => [styles.share, pressed && styles.sharePressed]}>
              <LineIcon name="share" size={18} color={colors.textStrong} strokeWidth={1.75} />
              <AppText style={styles.shareText}>{t('category_share_friend')}</AppText>
            </Pressable>
          ) : null
        }
        ListEmptyComponent={
          offers === null ? (
            failed ? null : <OfferListSkeleton />
          ) : offers.length > 0 ? (
            <View style={styles.empty} accessibilityLiveRegion="polite">
              <AppText style={styles.emptyTitle}>{t('cats_search_no_results_sub')}</AppText>
            </View>
          ) : (
            <CategoryEmptyState category={category} label={tile ? t(tile.labelKey) : category} />
          )
        }
      />
    </SafeAreaView>
  )
}

type CategoryRow = { key: string; type: 'offer'; offer: OfferDocument; nationwide?: boolean } | { key: string; type: 'nationwide' }
const rowKey = (row: CategoryRow) => row.key
const rowType = (row: CategoryRow) => row.type

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  // The back button sits on the leading side; the row flips with the root direction.
  bar: { flexDirection: 'row', alignItems: 'center', minHeight: 52, paddingHorizontal: 8 },
  content: { paddingHorizontal: 16, paddingTop: 4, paddingBottom: 24, flexGrow: 1 },
  header: { marginBottom: 16, gap: 14 },
  share: { alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 48, marginTop: 12, paddingHorizontal: 20, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.white },
  sharePressed: { opacity: 0.6 },
  shareText: { fontSize: 15, fontWeight: '600', color: colors.textStrong },
  controls: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  nationwideTitle: { fontSize: 17, lineHeight: 24, fontWeight: '700', color: colors.heading, marginTop: 8, marginBottom: 12 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  emojiBox: {
    width: 60,
    height: 60,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.borderLight,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleText: { flex: 1, minWidth: 0, gap: 2 },
  count: { fontSize: 14, lineHeight: 20, color: colors.textMuted, fontVariant: ['tabular-nums'] },
  countPlaceholder: { height: 12, width: 110, marginTop: 6, borderRadius: radius.pill, backgroundColor: colors.borderLight },
  empty: { alignItems: 'center', marginTop: 48, paddingHorizontal: 24 },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: colors.heading, textAlign: 'center', marginBottom: 4 },
})

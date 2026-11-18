import { useCallback, useDeferredValue, useMemo, useState } from 'react'
import { Platform, Pressable, RefreshControl, StyleSheet, View, type ViewToken } from 'react-native'
import { FlashList } from '@shopify/flash-list'
import { useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import Animated, { Easing, FadeInDown } from 'react-native-reanimated'
import { GestureDetector } from 'react-native-gesture-handler'
import { EASE_SILK, ONB } from '@shared/brand/onboardingMotion'
import { applyLocationFilter } from '@shared/perks/locationFilter'
import { normalizeQuery, offerMatchesSearch } from '@shared/perks/perksFilter'
import { useLocationFilter } from '../../lib/useLocationFilter'
import LocationFilterBar from '../../components/LocationFilterBar'
import type { OfferDocument } from '@shared/firebase/offers'
import { useOffers } from '@shared/offers/useOffers'
import { useAuth } from '@shared/firebase/useAuth'
import { useMemberProfile } from '@shared/firebase/useMemberProfile'
import { useVouchers } from '@shared/firebase/VouchersProvider'
import { greetingKey } from '@shared/auth/greeting'
import { useGreetingPeriod } from '@shared/home/useGreetingPeriod'
import FeedCell from '../../components/FeedCell'
import OfferCard from '../../components/OfferCard'
import PerksSearchField from '../../components/PerksSearchField'
import MultiChainShowcase from '../../components/MultiChainShowcase'
import { buildCategoryRails, selectCurated, selectHighlights, selectSuperVouchers, type CategoryRailGroup } from '@shared/home/categoryRails'
import ActivePassCard from '../../components/ActivePassCard'
import AppText from '../../components/AppText'
import Avatar from '../../components/Avatar'
import AvatarViewer, { useAvatarPeek } from '../../components/AvatarViewer'
import CategoryOfferRail from '../../components/CategoryOfferRail'
import CategoryPhotoRail from '../../components/CategoryPhotoRail'
import Notice from '../../components/Notice'
import LineIcon from '../../components/LineIcon'
import OfferCarousel from '../../components/OfferCarousel'
import { RAIL_ICONS } from '../../lib/categoryGlyphs'
import ScreenTitleRow from '../../components/ScreenTitleRow'
import SectionHeader from '../../components/SectionHeader'
import TabHeader from '../../components/TabHeader'
import { OfferCarouselSkeleton } from '../../components/Skeleton'
import { useLang } from '../../i18n/LangProvider'
import { openOffer } from '../../lib/openOffer'
import { useLayout } from '../../lib/useLayout'
import { webOnly } from '../../lib/webStyles'
import { colors, header, radius, type } from '../../theme'

// The greeting fades and rises in once the profile is read, so a fallback
// name never flashes first (web: components/home/LoggedInHome.tsx).
// Not on web: Reanimated's web cleanup pins a custom entering animation's element with position: absolute once it
// ends, which takes the greeting out of the row and lands the search button on the avatar.
const GREETING_IN = Platform.OS === 'web' ? undefined : FadeInDown.duration(ONB.greetingMs)
  .easing(Easing.bezier(...EASE_SILK))
  .withInitialValues({ opacity: 0, transform: [{ translateY: ONB.screenRisePx }] })

// The signed-in dashboard, in the website's order (components/home/LoggedInHome.tsx):
// greeting, the member-pass card with the live active-pass count, quick
// category pills, Recommended for you, then a rail for each category with a
// claimable perk (lib/home/categoryRails.ts), so a category appears by itself
// with its first offer.

// Rows of Home's list, top to bottom: FlashList mounts only those near the
// viewport, so the category rails further down cost nothing until they scroll
// close, and each rail's autoplay holds still while it is out of view.
type HomeRow =
  | { key: 'top'; type: 'top' }
  | { key: 'showcase'; type: 'showcase'; offer: OfferDocument }
  | { key: 'photos'; type: 'photos' }
  | { key: 'curated'; type: 'curated' }
  | { key: 'new' | 'bestsellers'; type: 'highlight'; offers: OfferDocument[] }
  | { key: string; type: 'rail'; rail: CategoryRailGroup }
  | { key: string; type: 'result'; offer: OfferDocument; index: number }
  | { key: 'noResults'; type: 'noResults' }

const VIEWABILITY = { itemVisiblePercentThreshold: 5 }
const rowKey = (row: HomeRow) => row.key
const rowType = (row: HomeRow) => row.type

export default function HomeScreen() {
  const { t, lang } = useLang()
  // The side padding follows the window: 12 on a folded cover screen, 16 on a
  // phone, 24 unfolded (src/lib/layout.ts); the rails bleed through the same.
  const { paddingLeft, paddingRight, columns, cellWidth } = useLayout()
  const { user } = useAuth()
  const router = useRouter()
  const { loaded, firstName, initials, photoURL } = useMemberProfile(user)
  // Live from the shared voucher listener (one for Home and the wallet): a web purchase or a
  // business redemption updates the badge in moments. null until the first snapshot (or if the
  // read is refused): the card shows "–", never a fake 0.
  const activeCount = useVouchers().active?.length ?? null
  // "Good afternoon, Dana" by the member's own clock, like the website's Home; the plain welcome only until it is read.
  const period = useGreetingPeriod()
  // The shared catalog (lib/offers/offersStore.ts): the saved or held copy draws on the first frame, a stale one refreshes behind it.
  const { offers, failed, refresh } = useOffers()
  const [refreshing, setRefreshing] = useState(false)
  const [photoOpen, setPhotoOpen] = useState(false)
  const peek = useAvatarPeek(photoURL)

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    await refresh()
    setRefreshing(false)
  }, [refresh])

  // The search button opens a search bar right here (no tab change); results replace the feed while there is a query.
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  // The field updates on the keystroke's frame; the catalog is filtered against the deferred copy, in the background.
  const deferredQuery = useDeferredValue(searchQuery)
  const closeSearch = () => { setSearchOpen(false); setSearchQuery('') }
  const openPass = () => router.navigate('/wallet')
  const openCategory = useCallback((category: string) => router.push({ pathname: '/category/[category]', params: { category } }), [router])
  // Near me / a picked area narrows every list on Home (lib/perks/locationFilter.ts).
  const location = useLocationFilter()
  const located = useMemo(() => (offers ? applyLocationFilter(offers, location.filter) : null), [offers, location.filter])
  const locEmpty = !!location.filter && !!located && !located.some((o) => o.perkScope !== 'multi_chain')
  const curated = useMemo(() => selectCurated(located ?? []), [located])
  const superOffers = useMemo(() => selectSuperVouchers(located ?? []), [located])
  const highlights = useMemo(() => selectHighlights(located ?? []), [located])
  const normalizedQuery = normalizeQuery(deferredQuery)
  const searching = searchOpen && normalizeQuery(searchQuery).length > 0
  const results = useMemo(
    () => (searching && normalizedQuery ? (located ?? []).filter((o) => offerMatchesSearch(o, normalizedQuery, t, lang)) : []),
    [searching, located, normalizedQuery, t, lang]
  )
  const rails = useMemo(() => (located ? buildCategoryRails(located) : []), [located])

  const rows = useMemo<HomeRow[]>(() => {
    if (searching) {
      return results.length === 0 ? [{ key: 'noResults', type: 'noResults' }] : results.map((offer, index) => ({ key: `r:${offer.id}`, type: 'result', offer, index }))
    }
    const list: HomeRow[] = [{ key: 'top', type: 'top' }]
    if (superOffers[0]) list.push({ key: 'showcase', type: 'showcase', offer: superOffers[0] })
    list.push({ key: 'photos', type: 'photos' }, { key: 'curated', type: 'curated' })
    if (highlights.newOffers.length > 0) list.push({ key: 'new', type: 'highlight', offers: highlights.newOffers })
    if (highlights.bestsellerOffers.length > 0) list.push({ key: 'bestsellers', type: 'highlight', offers: highlights.bestsellerOffers })
    for (const rail of rails) list.push({ key: `c:${rail.category}`, type: 'rail', rail })
    return list
  }, [searching, results, superOffers, highlights, rails])

  // Which rows are on screen: a rail's autoplay runs only while it is.
  const [visibleKeys, setVisibleKeys] = useState<ReadonlySet<string>>(() => new Set(['curated', 'new', 'bestsellers']))
  const onViewableItemsChanged = useCallback(({ viewableItems }: { viewableItems: ViewToken<HomeRow>[] }) => {
    const next = new Set(viewableItems.map((v) => v.key))
    setVisibleKeys((prev) => (prev.size === next.size && [...next].every((k) => prev.has(k)) ? prev : next))
  }, [])

  const renderRow = ({ item }: { item: HomeRow }) => {
    switch (item.type) {
      case 'top':
        return (
          <>
            <ActivePassCard count={activeCount} onPress={openPass} />
            {/* Choosing an area lives in the Perks tab's Filter sheet; a location set there is not carried here, so the bar shows only when one is active. */}
            <LocationFilterBar filter={location.filter} onRadius={location.setRadiusKm} onClear={location.clear} />
            {locEmpty && (
              <View style={styles.empty}>
                <AppText style={styles.emptyTitle}>{t('loc_empty_title').replace('{km}', String(location.filter?.kind === 'gps' ? location.filter.radiusKm : ''))}</AppText>
                <AppText style={styles.emptySub}>{t('loc_empty_sub')}</AppText>
                {location.filter?.kind === 'gps' && location.filter.radiusKm < 25 && (
                  <Pressable accessibilityRole="button" onPress={() => location.setRadiusKm(location.filter?.kind === 'gps' && location.filter.radiusKm === 5 ? 15 : 25)} style={styles.expand}>
                    <AppText style={styles.expandText}>{t('loc_expand').replace('{km}', String(location.filter.radiusKm === 5 ? 15 : 25))}</AppText>
                  </Pressable>
                )}
              </View>
            )}
          </>
        )
      case 'showcase':
        // The flagship multi-chain voucher: one card per value (100 / 150), each opening the offer with it picked, above the categories.
        return <MultiChainShowcase offer={item.offer} />
      case 'photos':
        return (
          <>
            <SectionHeader title={t('home_top_categories')} />
            <CategoryPhotoRail onSelect={openCategory} />
          </>
        )
      case 'curated':
        return (
          <>
            <SectionHeader title={t('home_curated_title')} action={t('home_see_all')} onAction={() => router.navigate({ pathname: '/perks', params: { cat: '', sort: '' } })} />
            {failed && <Notice message={t('mobile_load_error')} />}
            {offers === null ? (
              !failed && <OfferCarouselSkeleton />
            ) : curated.length === 0 ? (
              <View style={styles.empty}>
                <AppText style={styles.emptyTitle}>{t('deals_empty_title')}</AppText>
                <AppText style={styles.emptySub}>{t('deals_empty_sub')}</AppText>
              </View>
            ) : (
              <OfferCarousel key="curated" offers={curated} onOpen={openOffer} autoAdvance visible={visibleKeys.has('curated')} />
            )}
          </>
        )
      case 'highlight': {
        // The Perks tab's two highlight rails, each moving on its own beat (curated 0, New +1.5s, Best Sellers +3s).
        const isNew = item.key === 'new'
        return (
          <>
            <SectionHeader
              leading={<LineIcon name={isNew ? RAIL_ICONS.new : RAIL_ICONS.bestsellers} size={18} color={colors.textStrong} strokeWidth={1.5} />}
              title={t(isNew ? 'row_new' : 'row_bestsellers')}
              action={t('home_see_all')}
              onAction={() => router.navigate('/perks')}
            />
            <OfferCarousel key={item.key} offers={item.offers} onOpen={openOffer} autoAdvance autoAdvanceOffsetMs={isNew ? 1500 : 3000} visible={visibleKeys.has(item.key)} />
          </>
        )
      }
      case 'rail':
        // Keyed by category: a recycled row remounts its rail, so one rail's scroll position never shows on another.
        return <CategoryOfferRail key={item.rail.category} rail={item.rail} onSeeAll={item.rail.tile ? openCategory : undefined} visible={visibleKeys.has(item.key)} />
      case 'result':
        return (
          <FeedCell column={item.index}>
            <OfferCard offer={item.offer} onOpen={openOffer} width={columns > 1 ? cellWidth : undefined} />
          </FeedCell>
        )
      case 'noResults':
        return (
          <View style={styles.empty} accessibilityLiveRegion="polite">
            <AppText style={styles.emptyTitle}>{t('cats_search_no_results_title').replace('{query}', searchQuery.trim())}</AppText>
            <AppText style={styles.emptySub}>{t('cats_search_no_results_sub')}</AppText>
          </View>
        )
    }
  }

  const listHeader = searchOpen ? (
    <View style={[styles.searchRow, styles.greetingSlot]}>
      <PerksSearchField value={searchQuery} onChangeText={setSearchQuery} autoFocus />
      {searchQuery.length > 0 && (
        <Pressable accessibilityRole="button" accessibilityLabel={t('loc_clear')} hitSlop={6} onPress={() => setSearchQuery('')} style={styles.clearButton}>
          <LineIcon name="close" size={16} color={colors.textMuted} strokeWidth={2} />
        </Pressable>
      )}
      <Pressable accessibilityRole="button" accessibilityLabel={t('avatar_cancel')} hitSlop={6} onPress={closeSearch} style={styles.cancelButton}>
        <AppText style={styles.cancelText}>{t('avatar_cancel')}</AppText>
      </Pressable>
    </View>
  ) : (
    <ScreenTitleRow
      style={styles.greetingSlot}
      trailing={
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('cats_search_placeholder')}
          hitSlop={4}
          onPress={() => setSearchOpen(true)}
          style={({ pressed }) => [styles.searchButton, pressed && styles.searchPressed]}
        >
          <LineIcon name="search" size={20} color="#0B1B3D" strokeWidth={2} />
        </Pressable>
      }
    >
      {loaded && (
        <Animated.View entering={GREETING_IN} style={styles.greetingRow}>
          {/* With a photo, a tap opens it full size and a long press peeks at it; a monogram stays decorative. */}
          {photoURL ? (
            <GestureDetector gesture={peek.gesture}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('avatar_view')}
                onPressIn={peek.pressIn}
                onPress={() => {
                  if (!peek.wasPeek()) setPhotoOpen(true)
                }}
                hitSlop={4}
                style={({ pressed }) => [styles.avatarButton, pressed && styles.avatarPressed]}
              >
                <Avatar uri={photoURL} initials={initials} size={header.avatar} />
              </Pressable>
            </GestureDetector>
          ) : (
            <Avatar uri={photoURL} initials={initials} size={header.avatar} />
          )}
          {/* Just the welcome: no tagline under it, so the header stays one compact row. */}
          {/* A long name wraps to a second line and shrinks a little before it is cut with an ellipsis; the avatar and the search button stay centred on the row. */}
          <AppText accessibilityRole="header" style={[type.greeting, styles.greetingText]} numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.78}>
            {period
              ? t(greetingKey(period, !!firstName)).replace('{name}', firstName ?? '')
              : firstName ? t('home_welcome').replace('{name}', firstName) : t('home_welcome_generic')}
          </AppText>
        </Animated.View>
      )}
    </ScreenTitleRow>
  )

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <TabHeader />
      <FlashList
        data={rows}
        renderItem={renderRow}
        keyExtractor={rowKey}
        getItemType={rowType}
        numColumns={searching && results.length > 0 ? columns : 1}
        key={searching && results.length > 0 ? `results-${columns}` : 'feed'}
        extraData={visibleKeys}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={VIEWABILITY}
        ListHeaderComponent={listHeader}
        showsVerticalScrollIndicator={false}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={[styles.content, { paddingLeft, paddingRight }]}
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brand} />}
      />
      {photoURL && <AvatarViewer uri={photoURL} visible={photoOpen} onClose={() => setPhotoOpen(false)} />}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  // The SafeAreaView already clears the status bar / Dynamic Island; the
  // greeting starts header.top below it, as every tab's title does.
  content: { paddingHorizontal: 16, paddingTop: header.top, paddingBottom: 24, flexGrow: 1 },
  // The title row holds the avatar's height while the profile loads, so nothing jumps.
  greetingSlot: { marginBottom: header.gap },
  greetingRow: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatarButton: { borderRadius: radius.pill, ...webOnly({ cursor: 'zoom-in' }) },
  avatarPressed: { opacity: 0.85 },
  greetingText: { flex: 1, minWidth: 0 },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  clearButton: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  cancelButton: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 4 },
  cancelText: { fontSize: 15, fontWeight: '600', color: colors.brand },
  searchButton: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E2E8F0', flexShrink: 0 },
  searchPressed: { backgroundColor: '#F1F5F9' },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 14 },
  locationBar: { flex: 1, minWidth: 0 },
  geoError: { fontSize: 13, lineHeight: 18, fontWeight: '600', color: colors.danger, marginTop: 6 },
  expand: { minHeight: 44, justifyContent: 'center' },
  expandText: { fontSize: 14, fontWeight: '700', color: colors.brand },
  empty: { alignItems: 'center', marginTop: 24, paddingHorizontal: 24 },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: colors.heading, textAlign: 'center', marginBottom: 4 },
  emptySub: { fontSize: 14, color: colors.body, textAlign: 'center' },
})

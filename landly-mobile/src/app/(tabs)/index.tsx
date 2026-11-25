import { useCallback, useMemo, useState } from 'react'
import { Platform, Pressable, RefreshControl, StyleSheet, View, type ViewToken } from 'react-native'
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg'
import { FlashList } from '@shopify/flash-list'
import { useRouter } from 'expo-router'
import Animated, { Easing, FadeInDown } from 'react-native-reanimated'
import { GestureDetector } from 'react-native-gesture-handler'
import { EASE_SILK, ONB } from '@shared/brand/onboardingMotion'
import { applyLocationFilterWithNationwide, partitionByLocation } from '@shared/perks/locationFilter'
import { useLocationFilter } from '../../lib/useLocationFilter'
import LocationFilterBar from '../../components/LocationFilterBar'
import { useOffers } from '@shared/offers/useOffers'
import { isFlagship, isRaayonitOffer, landlyOffers } from '@shared/offers/discoverTab'
import { useAuth } from '@shared/firebase/useAuth'
import { useMemberProfile } from '@shared/firebase/useMemberProfile'
import { useVouchers } from '@shared/firebase/VouchersProvider'
import { greetingKey } from '@shared/auth/greeting'
import { useGreetingPeriod } from '@shared/home/useGreetingPeriod'
import { buildHomeCategorySlots, homeIsEmpty, type HomeCategorySlots } from '@shared/home/categoryRails'
import { selectChainsPreview } from '@shared/home/chainsPreview'
import CategoryIcon from '../../components/CategoryIcon'
import CategoryPhotoRail from '../../components/CategoryPhotoRail'
import LiveChainsSection from '../../components/LiveChainsSection'
import RaayonitBanner from '../../components/RaayonitBanner'
import SectionDivider from '../../components/SectionDivider'
import RaayonitPromoStrip from '../../components/RaayonitPromoStrip'
import { useRaayonitDisplay } from '@shared/flags/raayonitDisplayStore'
import ActivePassCard from '../../components/ActivePassCard'
import AppText from '../../components/AppText'
import Avatar from '../../components/Avatar'
import AvatarViewer, { useAvatarPeek } from '../../components/AvatarViewer'
import Notice from '../../components/Notice'
import OfferCarousel from '../../components/OfferCarousel'
import ScreenTitleRow from '../../components/ScreenTitleRow'
import SectionHeader from '../../components/SectionHeader'
import TabScreen from '../../components/TabScreen'
import { OfferCarouselSkeleton } from '../../components/Skeleton'
import { useLang } from '../../i18n/LangProvider'
import { openOffer } from '../../lib/openOffer'
import { useLayout } from '../../lib/useLayout'
import { webOnly } from '../../lib/webStyles'
import { colors, header, radius, type } from '../../theme'

// The greeting fades and rises in once the profile is read, so a fallback
// name never flashes first (web: components/home/LoggedInHome.tsx).
// Not on web: Reanimated's web cleanup pins a custom entering animation's element with position: absolute once it
// ends, which takes the greeting out of the row and lands it on the avatar.
const GREETING_IN = Platform.OS === 'web' ? undefined : FadeInDown.duration(ONB.greetingMs)
  .easing(Easing.bezier(...EASE_SILK))
  .withInitialValues({ opacity: 0, transform: [{ translateY: ONB.screenRisePx }] })

// The signed-in dashboard, in the website's order (components/home/LoggedInHome.tsx):
// greeting, the member-pass card with the live active-pass count, then a row for
// every GoLandly category with ten slots (buildHomeCategorySlots in
// lib/home/categoryRails.ts): real perks first, "Coming soon" placeholders after,
// so a published perk takes a placeholder's place by itself. No Raayonit here:
// it has its own tab.

// Rows of Home's list, top to bottom: FlashList mounts only those near the
// viewport, so the category rails further down cost nothing until they scroll
// close, and each rail's autoplay holds still while it is out of view.
type HomeRow =
  | { key: 'top'; type: 'top' }
  | { key: 'banner'; type: 'banner' }
  | { key: 'categories'; type: 'categories' }
  | { key: 'hero'; type: 'hero' }
  | { key: 'divider'; type: 'divider' }
  | { key: 'live'; type: 'live' }
  | { key: 'loading'; type: 'loading' }
  | { key: string; type: 'category'; group: HomeCategorySlots }

const TOP_FADE = 20
const HOME_FIRST_CATEGORY = 'Restaurants and Cafes'
const VIEWABILITY = { itemVisiblePercentThreshold: 5 }
const rowKey = (row: HomeRow) => row.key
const rowType = (row: HomeRow) => row.type

export default function HomeScreen() {
  const { t, lang } = useLang()
  // The side padding follows the window: 12 on a folded cover screen, 16 on a
  // phone, 24 unfolded (src/lib/layout.ts); the rails bleed through the same.
  const { paddingLeft, paddingRight } = useLayout()
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

  const openPass = () => router.navigate('/wallet')
  const openCategory = useCallback((category: string) => router.push({ pathname: '/category/[category]', params: { category } }), [router])
  // Near me / a picked area narrows every list on Home (lib/perks/locationFilter.ts).
  const location = useLocationFilter()
  // Home shows GoLandly's own perks only; Raayonit's "תו על" has its own tab.
  const allLocated = useMemo(() => (offers ? applyLocationFilterWithNationwide(offers, location.filter) : null), [offers, location.filter])
  const located = useMemo(() => (allLocated ? landlyOffers(allLocated) : null), [allLocated])
  const locEmpty = !!location.filter && !!offers && !partitionByLocation(offers, location.filter).nearby.some((o) => o.perkScope !== 'multi_chain')
  const raayonitOffers = useMemo(() => (offers ?? []).filter(isRaayonitOffer), [offers])
  const flagship = useMemo(() => raayonitOffers.find(isFlagship) ?? null, [raayonitOffers])
  const chainCount = useMemo(() => raayonitOffers.filter((o) => !isFlagship(o)).length, [raayonitOffers])
  // The entry banner to the Raayonit Card tab: there while the tab is (Raayonit's name may be shown).
  const showBanner = useRaayonitDisplay()
  const chainsPreview = useMemo(() => selectChainsPreview(raayonitOffers, lang), [raayonitOffers, lang])
  const categoryGroups = useMemo(() => (located ? buildHomeCategorySlots(located) : null), [located])
  const rows = useMemo<HomeRow[]>(() => {
    const list: HomeRow[] = [{ key: 'top', type: 'top' }]
    // The entry strip gives way to the live section while GoLandly has no direct perks (it would repeat the same count); it returns with the first one.
    const empty = !!categoryGroups && homeIsEmpty(categoryGroups)
    const live = empty && showBanner && chainsPreview.length > 0
    // The carousel leads Home while GoLandly has no direct perks (the Raayonit Card is what works today); the slim strip returns with the first perk.
    if (live) list.push({ key: 'hero', type: 'hero' })
    else if (showBanner) list.push({ key: 'banner', type: 'banner' })
    if (!categoryGroups) {
      // A failed read still leaves the category tiles to browse; no "on their way" note, which would be untrue.
      if (!failed) return [...list, { key: 'loading', type: 'loading' }]
      return [...list, { key: 'categories', type: 'categories' }]
    }
    // No direct perk yet: the businesses available now, a hairline, then the category photo rail, instead of 13 rows of placeholders.
    if (empty) {
      if (live) list.push({ key: 'live', type: 'live' }, { key: 'divider', type: 'divider' })
      list.push({ key: 'categories', type: 'categories' })
      return list
    }
    // Only categories that hold a real perk get a row, and each shows just its perks.
    for (const group of categoryGroups) if (group.slots.some((slot) => slot.kind === 'offer')) list.push({ key: `cat:${group.tile.category}`, type: 'category', group })
    return list
  }, [categoryGroups, failed, showBanner, chainsPreview])

  // Which rows are on screen: a rail's autoplay runs only while it is.
  const [visibleKeys, setVisibleKeys] = useState<ReadonlySet<string>>(() => new Set(['cat:Restaurants and Cafes']))
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
      case 'banner':
        return <View style={styles.banner}><RaayonitPromoStrip offer={flagship} count={chainCount} /></View>
      case 'hero':
        return <RaayonitBanner />
      case 'divider':
        return <SectionDivider style={styles.divider} />
      case 'categories':
        return (
          <>
            {failed && <Notice message={t('mobile_load_error')} />}
            <SectionHeader title={t('perks_browse_categories')} />
            <CategoryPhotoRail onSelect={openCategory} />
          </>
        )
      case 'live':
        return <LiveChainsSection offers={chainsPreview} chainCount={chainCount} />
      case 'loading':
        return <OfferCarouselSkeleton />
      case 'category': {
        const { tile, slots } = item.group
        const real = slots.flatMap((slot) => (slot.kind === 'offer' ? [slot.offer] : []))
        return (
          <>
            {failed && item.key === 'cat:' + HOME_FIRST_CATEGORY && <Notice message={t('mobile_load_error')} />}
            <SectionHeader
              leading={<CategoryIcon category={tile.category} size={18} strokeWidth={1.5} color={colors.textStrong} />}
              title={t(tile.labelKey)}
              action={t('perk_see_all_perks')}
              onAction={() => openCategory(tile.category)}
            />
            <OfferCarousel key={item.key} offers={real} placeholders={0} onOpen={openOffer} showDots={false} showCategoryBadge={false} visible={visibleKeys.has(item.key)} />
          </>
        )
      }
    }
  }

  const listHeader = (
    <ScreenTitleRow style={styles.greetingSlot}>
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
          {/* A long name wraps to a second line and shrinks a little before it is cut with an ellipsis; the avatar stays centred on the row. */}
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
    <TabScreen>
      <View style={styles.listWrap}>
      <FlashList
        data={rows}
        renderItem={renderRow}
        keyExtractor={rowKey}
        getItemType={rowType}
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
      {/* Content scrolled up under the header (the pass card, mid-scroll) dissolves into the page instead of being sliced into a stray strip above the carousel. */}
      <Svg pointerEvents="none" style={styles.topFade} width="100%" height={TOP_FADE} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <Defs>
          <LinearGradient id="homeTopFade" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={colors.background} stopOpacity={1} />
            <Stop offset="1" stopColor={colors.background} stopOpacity={0} />
          </LinearGradient>
        </Defs>
        <Rect width="100%" height={TOP_FADE} fill="url(#homeTopFade)" />
      </Svg>
      </View>
      {photoURL && <AvatarViewer uri={photoURL} visible={photoOpen} onClose={() => setPhotoOpen(false)} />}
    </TabScreen>
  )
}

const styles = StyleSheet.create({
  listWrap: { flex: 1 },
  topFade: { position: 'absolute', top: 0, start: 0, end: 0 },
  // TabScreen's SafeAreaView already clears the status bar / Dynamic Island; the
  // greeting starts header.top below it, as every tab's title does.
  content: { paddingHorizontal: 16, paddingTop: header.top, paddingBottom: 110, flexGrow: 1 },
  // The title row holds the avatar's height while the profile loads, so nothing jumps.
  greetingSlot: { marginBottom: header.gap },
  greetingRow: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatarButton: { borderRadius: radius.pill, ...webOnly({ cursor: 'zoom-in' }) },
  avatarPressed: { opacity: 0.85 },
  greetingText: { flex: 1, minWidth: 0 },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 14 },
  locationBar: { flex: 1, minWidth: 0 },
  geoError: { fontSize: 13, lineHeight: 18, fontWeight: '600', color: colors.danger, marginTop: 6 },
  expand: { minHeight: 44, justifyContent: 'center' },
  expandText: { fontSize: 14, fontWeight: '700', color: colors.brand },
  // Air between the pass card and the Raayonit entry banner, and before the first category row.
  banner: { marginTop: 16, marginBottom: 8 },
  // The hairline between the available-now rail and the categories.
  divider: { marginTop: 20 },
  empty: { alignItems: 'center', marginTop: 24, paddingHorizontal: 24 },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: colors.heading, textAlign: 'center', marginBottom: 4 },
  emptySub: { fontSize: 14, color: colors.body, textAlign: 'center' },
})

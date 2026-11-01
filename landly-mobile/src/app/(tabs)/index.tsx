import { useCallback, useEffect, useMemo, useState } from 'react'
import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native'
import { useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import Animated, { Easing, FadeInDown } from 'react-native-reanimated'
import { GestureDetector } from 'react-native-gesture-handler'
import { EASE_SILK, ONB } from '@shared/brand/onboardingMotion'
import { getAllOffers, type OfferDocument } from '@shared/firebase/offers'
import { useAuth } from '@shared/firebase/useAuth'
import { useMemberProfile } from '@shared/firebase/useMemberProfile'
import { subscribeToUserVouchers } from '@shared/firebase/vouchers'
import { buildCategoryRails, selectCurated } from '@shared/home/categoryRails'
import ActivePassCard from '../../components/ActivePassCard'
import AppText from '../../components/AppText'
import Avatar from '../../components/Avatar'
import AvatarViewer, { useAvatarPeek } from '../../components/AvatarViewer'
import CategoryOfferRail from '../../components/CategoryOfferRail'
import CategoryPhotoRail from '../../components/CategoryPhotoRail'
import Notice from '../../components/Notice'
import OfferCarousel from '../../components/OfferCarousel'
import ScreenTitleRow from '../../components/ScreenTitleRow'
import SectionHeader from '../../components/SectionHeader'
import { OfferCarouselSkeleton } from '../../components/Skeleton'
import { useLang } from '../../i18n/LangProvider'
import { openOffer } from '../../lib/openOffer'
import { useLayout } from '../../lib/useLayout'
import { webOnly } from '../../lib/webStyles'
import { colors, header, radius, type } from '../../theme'

// The greeting fades and rises in once the profile is read, so a fallback
// name never flashes first (web: components/home/LoggedInHome.tsx).
const GREETING_IN = FadeInDown.duration(ONB.greetingMs)
  .easing(Easing.bezier(...EASE_SILK))
  .withInitialValues({ opacity: 0, transform: [{ translateY: ONB.screenRisePx }] })

// The signed-in dashboard, in the website's order (components/home/LoggedInHome.tsx):
// greeting, the member-pass card with the live active-pass count, quick
// category pills, Recommended for you, then a rail for each category with a
// claimable perk (lib/home/categoryRails.ts), so a category appears by itself
// with its first offer.

export default function HomeScreen() {
  const { t } = useLang()
  // The side padding follows the window: 12 on a folded cover screen, 16 on a
  // phone, 24 unfolded (src/lib/layout.ts); the rails bleed through the same.
  const { paddingLeft, paddingRight } = useLayout()
  const { user } = useAuth()
  const router = useRouter()
  const { loaded, firstName, initials, photoURL } = useMemberProfile(user)
  // null until the first snapshot (or if the read is refused): the card shows "–", never a fake 0.
  const [activeCount, setActiveCount] = useState<number | null>(null)
  const [offers, setOffers] = useState<OfferDocument[] | null>(null)
  const [failed, setFailed] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [photoOpen, setPhotoOpen] = useState(false)
  const peek = useAvatarPeek(photoURL)

  // Live: a web purchase or a business redemption updates the badge in moments.
  useEffect(() => {
    if (!user) return
    return subscribeToUserVouchers(
      user.uid,
      'active',
      (vouchers) => setActiveCount(vouchers.length),
      () => setActiveCount(null)
    )
  }, [user])

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

  const openPass = () => router.navigate('/wallet')
  const openCategory = (category: string) => router.push({ pathname: '/category/[category]', params: { category } })
  const curated = useMemo(() => selectCurated(offers ?? []), [offers])
  const rails = useMemo(() => (offers ? buildCategoryRails(offers) : []), [offers])

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={[styles.content, { paddingLeft, paddingRight }]}
        contentInsetAdjustmentBehavior="automatic"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brand} />}
      >
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
              <AppText accessibilityRole="header" style={[type.greeting, styles.greetingText]} numberOfLines={1}>
                {firstName ? t('home_welcome').replace('{name}', firstName) : t('home_welcome_generic')}
              </AppText>
            </Animated.View>
          )}
        </ScreenTitleRow>

        <ActivePassCard count={activeCount} onPress={openPass} />

        <SectionHeader title={t('home_top_categories')} />
        <CategoryPhotoRail onSelect={openCategory} />

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
          <OfferCarousel offers={curated} onOpen={openOffer} />
        )}

        {rails.map((rail) => (
          <CategoryOfferRail key={rail.category} rail={rail} onSeeAll={rail.tile ? () => openCategory(rail.category) : undefined} />
        ))}
      </ScrollView>
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
  empty: { alignItems: 'center', marginTop: 24, paddingHorizontal: 24 },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: colors.heading, textAlign: 'center', marginBottom: 4 },
  emptySub: { fontSize: 14, color: colors.body, textAlign: 'center' },
})

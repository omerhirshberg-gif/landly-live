import { useCallback, useEffect, useState } from 'react'
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native'
import { useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import Animated, { Easing, FadeInDown } from 'react-native-reanimated'
import Svg, { Path } from 'react-native-svg'
import { ARCH, ARROW, EMBLEM_VIEWBOX, STAR } from '@shared/brand/emblemPaths'
import { GestureDetector } from 'react-native-gesture-handler'
import { EASE_SILK, ONB } from '@shared/brand/onboardingMotion'
import { getAllOffers, sortFeaturedOffers, type OfferDocument } from '@shared/firebase/offers'
import { useAuth } from '@shared/firebase/useAuth'
import { useMemberProfile } from '@shared/firebase/useMemberProfile'
import { subscribeToUserVouchers } from '@shared/firebase/vouchers'
import AppText from '../../components/AppText'
import Avatar from '../../components/Avatar'
import AvatarViewer, { useAvatarPeek } from '../../components/AvatarViewer'
import CategoryRail from '../../components/CategoryRail'
import Notice from '../../components/Notice'
import OfferCarousel from '../../components/OfferCarousel'
import ScreenTitleRow from '../../components/ScreenTitleRow'
import SectionHeader from '../../components/SectionHeader'
import { useLang } from '../../i18n/LangProvider'
import { openOffer } from '../../lib/openOffer'
import { useLayout } from '../../lib/useLayout'
import { webOnly } from '../../lib/webStyles'
import { colors, header, radius, type } from '../../theme'

const CURATED_COUNT = 4

// The greeting fades and rises in once the profile is read, so a fallback
// name never flashes first (web: components/home/LoggedInHome.tsx).
const GREETING_IN = FadeInDown.duration(ONB.greetingMs)
  .easing(Easing.bezier(...EASE_SILK))
  .withInitialValues({ opacity: 0, transform: [{ translateY: ONB.screenRisePx }] })

// The signed-in dashboard: greeting, the member-pass hero with the live
// active-pass count, a few curated offers in a horizontal carousel of compact
// cards (components/OfferCarousel.tsx), then the categories rail.
const fetchOffers = async () => sortFeaturedOffers(await getAllOffers()).slice(0, CURATED_COUNT)

export default function HomeScreen() {
  const { t, isRtl } = useLang()
  // The side padding follows the window: 12 on a folded cover screen, 16 on a
  // phone, 24 unfolded (src/lib/layout.ts); the rails bleed through the same.
  const { paddingLeft, paddingRight } = useLayout()
  const { user } = useAuth()
  const router = useRouter()
  const { loaded, firstName, initials, photoURL } = useMemberProfile(user)
  // null until the first snapshot (or if the read is refused): shows "–", never a fake 0.
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
      setOffers(await fetchOffers())
      setFailed(false)
    } catch {
      setFailed(true)
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    fetchOffers()
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

        {/* The hero: a member pass with the live count, the first thing under the greeting. */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${t('home_pass_label')}: ${activeCount ?? '–'}. ${t('home_pass_cta')}`}
          onPress={openPass}
          style={({ pressed }) => [styles.passCard, pressed && styles.passCardPressed]}
        >
          <View style={styles.passGlow} />
          {/* The Landly emblem as a watermark in the top end corner (web: components/home/LandlyMark.tsx). */}
          <Svg viewBox={`0 0 ${EMBLEM_VIEWBOX.width} ${EMBLEM_VIEWBOX.height}`} width={88} height={86} style={styles.passMark} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            {[STAR, ARCH, ARROW].flatMap((part) => [part.light, part.dark]).map((d) => (
              <Path key={d.slice(0, 24)} d={d} fill={colors.white} fillOpacity={0.15} fillRule="evenodd" />
            ))}
          </Svg>
          <View style={styles.passTop}>
            <View style={styles.iconBox}>
              <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke={colors.white} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <Path d="M3 8a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v2a2 2 0 0 0 0 4v2a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-2a2 2 0 0 0 0-4zM14 6v2M14 11v2M14 16v2" />
              </Svg>
            </View>
            <AppText style={styles.passLabel} numberOfLines={1}>
              {t('home_pass_label')}
            </AppText>
          </View>
          <View style={styles.passCount} accessibilityLiveRegion="polite">
            <AppText ltr style={styles.countText}>
              {activeCount ?? '–'}
            </AppText>
            <AppText style={styles.passMessage} numberOfLines={2}>
              {t('home_vouchers_message').replace('{count}', String(activeCount ?? 0))}
            </AppText>
          </View>
          {/* A ticket's perforation: notches cut into both edges and a dashed tear line. */}
          <View style={styles.perforation}>
            <View style={[styles.notch, styles.notchStart]} />
            <View style={styles.tearLine} />
            <View style={[styles.notch, styles.notchEnd]} />
          </View>
          <View style={styles.passCta}>
            <AppText style={styles.passCtaText} numberOfLines={1}>
              {t('home_pass_cta')}
            </AppText>
            <Svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke={colors.brand} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" style={isRtl && styles.flip}>
              <Path d="M5 12h14M12 5l7 7-7 7" />
            </Svg>
          </View>
        </Pressable>

        <SectionHeader title={t('home_curated_title')} action={t('home_see_all')} onAction={() => router.navigate({ pathname: '/perks', params: { cat: '', sort: '' } })} />
        {failed && <Notice message={t('mobile_load_error')} />}
        {offers === null ? (
          !failed && <ActivityIndicator color={colors.brand} style={styles.spinner} />
        ) : offers.length === 0 ? (
          <View style={styles.empty}>
            <AppText style={styles.emptyTitle}>{t('deals_empty_title')}</AppText>
            <AppText style={styles.emptySub}>{t('deals_empty_sub')}</AppText>
          </View>
        ) : (
          <OfferCarousel offers={offers} onOpen={openOffer} />
        )}

        <SectionHeader title={t('home_deals_title')} />
        <CategoryRail
          onSelect={(category) => router.push({ pathname: '/category/[category]', params: { category } })}
          onViewAll={() => router.navigate({ pathname: '/perks', params: { cat: '', sort: '' } })}
        />
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
  // The member pass: solid brand blue, rounded-2xl, lifted off the canvas.
  // No wider than 576pt (web: fold:max-w-xl), so on an unfolded screen it
  // stays a card at the start edge rather than a stretched banner.
  passCard: {
    maxWidth: 576,
    overflow: 'hidden',
    paddingTop: 18,
    paddingBottom: 16,
    paddingHorizontal: 18,
    backgroundColor: colors.brand,
    borderRadius: radius.lg,
    shadowColor: colors.brandDark,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.22,
    shadowRadius: 18,
    elevation: 6,
    ...webOnly({ cursor: 'pointer' }),
  },
  passCardPressed: { backgroundColor: colors.brandHover },
  // A soft light disc in the top end corner, for depth without a gradient dependency.
  passGlow: {
    position: 'absolute',
    top: -70,
    end: -50,
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  passMark: { position: 'absolute', top: 12, end: 14 },
  passTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  iconBox: { width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(255, 255, 255, 0.16)', alignItems: 'center', justifyContent: 'center' },
  passLabel: { flex: 1, minWidth: 0, fontSize: 13, fontWeight: '700', letterSpacing: 0.4, textTransform: 'uppercase', color: 'rgba(255, 255, 255, 0.85)' },
  // Clear of the watermark on the end side.
  passCount: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 14, paddingEnd: 72 },
  countText: { fontSize: 44, lineHeight: 50, fontWeight: '800', color: colors.white, fontVariant: ['tabular-nums'] },
  passMessage: { flex: 1, minWidth: 0, fontSize: 15, lineHeight: 21, fontWeight: '600', color: colors.white },
  perforation: { flexDirection: 'row', alignItems: 'center', marginVertical: 14, marginHorizontal: -18 },
  notch: { width: 18, height: 18, borderRadius: 9, backgroundColor: colors.background },
  notchStart: { marginStart: -9 },
  notchEnd: { marginEnd: -9 },
  tearLine: { flex: 1, marginHorizontal: 6, borderTopWidth: 1.5, borderStyle: 'dashed', borderColor: 'rgba(255, 255, 255, 0.35)' },
  passCta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 46,
    borderRadius: radius.md,
    backgroundColor: colors.white,
  },
  passCtaText: { fontSize: 15, fontWeight: '700', color: colors.brand },
  flip: { transform: [{ scaleX: -1 }] },
  spinner: { marginTop: 32 },
  empty: { alignItems: 'center', marginTop: 24, paddingHorizontal: 24 },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: colors.heading, textAlign: 'center', marginBottom: 4 },
  emptySub: { fontSize: 14, color: colors.body, textAlign: 'center' },
})

import { useCallback, useEffect, useState } from 'react'
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, View } from 'react-native'
import { useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import Animated, { Easing, FadeInDown } from 'react-native-reanimated'
import Svg, { Path } from 'react-native-svg'
import { EASE_SILK, ONB } from '@shared/brand/onboardingMotion'
import { getAllOffers, sortFeaturedOffers, type OfferDocument } from '@shared/firebase/offers'
import { useAuth } from '@shared/firebase/useAuth'
import { useMemberProfile } from '@shared/firebase/useMemberProfile'
import { subscribeToUserVouchers } from '@shared/firebase/vouchers'
import AppText from '../../components/AppText'
import Avatar from '../../components/Avatar'
import Button from '../../components/Button'
import CategoryRail from '../../components/CategoryRail'
import Notice from '../../components/Notice'
import OfferCarousel from '../../components/OfferCarousel'
import SectionHeader from '../../components/SectionHeader'
import { useLang } from '../../i18n/LangProvider'
import { openOffer } from '../../lib/openOffer'
import { colors, radius, type } from '../../theme'

const CURATED_COUNT = 4

// The greeting fades and rises in once the profile is read, so a fallback
// name never flashes first (web: components/home/LoggedInHome.tsx).
const GREETING_IN = FadeInDown.duration(ONB.greetingMs)
  .easing(Easing.bezier(...EASE_SILK))
  .withInitialValues({ opacity: 0, transform: [{ translateY: ONB.screenRisePx }] })

// The signed-in dashboard: greeting, the live active-pass count, the
// categories, and a few curated offers in a horizontal carousel of compact
// cards (components/OfferCarousel.tsx). Same sections as the website's
// member home (components/home/LoggedInHome.tsx).
const fetchOffers = async () => sortFeaturedOffers(await getAllOffers()).slice(0, CURATED_COUNT)

export default function HomeScreen() {
  const { t } = useLang()
  const { user } = useAuth()
  const router = useRouter()
  const { loaded, firstName, initials, photoURL } = useMemberProfile(user)
  // null until the first snapshot (or if the read is refused): shows "–", never a fake 0.
  const [activeCount, setActiveCount] = useState<number | null>(null)
  const [offers, setOffers] = useState<OfferDocument[] | null>(null)
  const [failed, setFailed] = useState(false)
  const [refreshing, setRefreshing] = useState(false)

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
        contentContainerStyle={styles.content}
        contentInsetAdjustmentBehavior="automatic"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brand} />}
      >
        <View style={styles.greetingSlot}>
          {loaded && (
            <Animated.View entering={GREETING_IN} style={styles.greetingRow}>
              <Avatar uri={photoURL} initials={initials} size={48} />
              {/* Just the welcome: no tagline under it, so the header stays one compact row. */}
              <AppText accessibilityRole="header" style={[type.greeting, styles.greetingText]} numberOfLines={1}>
                {firstName ? t('home_welcome').replace('{name}', firstName) : t('home_welcome_generic')}
              </AppText>
            </Animated.View>
          )}
        </View>

        <View style={styles.passCard}>
          <View style={styles.passRow}>
            <View style={styles.iconBox}>
              <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={colors.brand} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <Path d="M3 8a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v2a2 2 0 0 0 0 4v2a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-2a2 2 0 0 0 0-4zM14 6v2M14 11v2M14 16v2" />
              </Svg>
            </View>
            <AppText style={styles.passLabel}>{t('home_pass_label')}</AppText>
            <View style={styles.countPill} accessibilityLiveRegion="polite">
              <AppText ltr style={styles.countText}>
                {activeCount ?? '–'}
              </AppText>
            </View>
          </View>
          <AppText style={[type.body, styles.passMessage]}>
            {t('home_vouchers_message').replace('{count}', String(activeCount ?? 0))}
          </AppText>
          <Button label={t('home_pass_cta')} onPress={openPass} />
        </View>

        <SectionHeader title={t('home_deals_title')} />
        <CategoryRail
          onSelect={(category) => router.push({ pathname: '/category/[category]', params: { category } })}
          onViewAll={() => router.navigate({ pathname: '/perks', params: { cat: '', sort: '' } })}
        />

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
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  // The SafeAreaView already clears the status bar / Dynamic Island, so the
  // greeting needs only a few points more, not a second gap.
  content: { paddingHorizontal: 16, paddingTop: 4, paddingBottom: 24, flexGrow: 1 },
  // Holds the avatar's height while the profile loads, so nothing jumps.
  greetingSlot: { minHeight: 48, marginBottom: 16, justifyContent: 'center' },
  greetingRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  greetingText: { flex: 1, minWidth: 0 },
  passCard: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
  },
  passRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 10 },
  iconBox: { width: 40, height: 40, borderRadius: 12, backgroundColor: colors.brandLight, alignItems: 'center', justifyContent: 'center' },
  passLabel: { flex: 1, fontSize: 15, fontWeight: '600', color: colors.body },
  countPill: {
    minWidth: 40,
    height: 32,
    paddingHorizontal: 12,
    borderRadius: radius.pill,
    backgroundColor: colors.brandLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  countText: { fontSize: 16, fontWeight: '700', color: colors.brand, textAlign: 'center', fontVariant: ['tabular-nums'] },
  passMessage: { marginBottom: 16 },
  spinner: { marginTop: 32 },
  empty: { alignItems: 'center', marginTop: 24, paddingHorizontal: 24 },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: colors.heading, textAlign: 'center', marginBottom: 4 },
  emptySub: { fontSize: 14, color: colors.body, textAlign: 'center' },
})

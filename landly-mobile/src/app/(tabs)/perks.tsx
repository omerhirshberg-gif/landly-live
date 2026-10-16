import { useCallback, useEffect, useMemo, useState } from 'react'
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, TextInput, View } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import Svg, { Circle, Path } from 'react-native-svg'
import { getAllOffers, offerMatchesQuery, sortFeaturedOffers, type OfferDocument } from '@shared/firebase/offers'
import AppText from '../../components/AppText'
import CategoryChips from '../../components/CategoryChips'
import Notice from '../../components/Notice'
import OfferCard from '../../components/OfferCard'
import { useLang } from '../../i18n/LangProvider'
import { openOffer } from '../../lib/openOffer'
import { webOnly } from '../../lib/webStyles'
import { colors, radius, type } from '../../theme'

// The searchable catalog: the same offers collection the website reads,
// bestsellers first, then newest. The active category lives in the route
// (?category=…), so Home's category chips and "See all" open it preset.
const fetchOffers = async () => sortFeaturedOffers(await getAllOffers())

export default function PerksScreen() {
  const { t, isRtl } = useLang()
  const router = useRouter()
  const params = useLocalSearchParams<{ category?: string }>()
  const category = params.category || null
  const [query, setQuery] = useState('')
  const [offers, setOffers] = useState<OfferDocument[] | null>(null)
  const [failed, setFailed] = useState(false)
  const [refreshing, setRefreshing] = useState(false)

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

  const normalizedQuery = query.trim().toLowerCase()
  const visible = useMemo(
    () =>
      (offers ?? []).filter(
        (offer) => (!category || offer.category === category) && (!normalizedQuery || offerMatchesQuery(offer, normalizedQuery))
      ),
    [offers, category, normalizedQuery]
  )
  const filtering = !!category || !!normalizedQuery

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <FlatList
        data={visible}
        keyExtractor={(offer) => offer.id}
        renderItem={({ item }) => <OfferCard offer={item} onPress={() => openOffer(item)} />}
        contentContainerStyle={styles.content}
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brand} />}
        ListHeaderComponent={
          <View style={styles.header}>
            <AppText accessibilityRole="header" style={type.screenTitle}>
              {t('mobile_tab_perks')}
            </AppText>
            <View style={styles.search}>
              <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={colors.textFaint} strokeWidth={2} strokeLinecap="round">
                <Circle cx="11" cy="11" r="7" />
                <Path d="m20 20-3.5-3.5" />
              </Svg>
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder={t('cats_search_placeholder')}
                placeholderTextColor={colors.textFaint}
                accessibilityLabel={t('cats_search_placeholder')}
                returnKeyType="search"
                clearButtonMode="while-editing"
                autoCorrect={false}
                style={[styles.searchInput, { textAlign: isRtl ? 'right' : 'left', writingDirection: isRtl ? 'rtl' : 'ltr' }]}
              />
            </View>
            <CategoryChips
              active={category}
              allLabel={t('perks_filter_all')}
              onSelect={(next) => router.setParams({ category: next ?? '' })}
            />
            {failed && <Notice message={t('mobile_load_error')} />}
          </View>
        }
        ListEmptyComponent={
          offers === null ? (
            failed ? null : <ActivityIndicator color={colors.brand} style={styles.spinner} />
          ) : (
            <View style={styles.empty}>
              <AppText style={styles.emptyTitle}>
                {filtering ? t('cats_search_no_results_sub') : t('deals_empty_title')}
              </AppText>
              {!filtering && <AppText style={styles.emptySub}>{t('deals_empty_sub')}</AppText>}
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
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: 44,
    paddingHorizontal: 14,
    borderRadius: radius.pill,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
  },
  searchInput: {
    flex: 1,
    height: '100%',
    fontSize: 15,
    color: colors.heading,
    ...webOnly({ outlineStyle: 'none' as never }),
  },
  spinner: { marginTop: 48 },
  empty: { alignItems: 'center', marginTop: 48, paddingHorizontal: 24 },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: colors.heading, textAlign: 'center', marginBottom: 4 },
  emptySub: { fontSize: 14, color: colors.body, textAlign: 'center' },
})

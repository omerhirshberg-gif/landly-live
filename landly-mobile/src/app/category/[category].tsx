import { useCallback, useEffect, useMemo, useState } from 'react'
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, View } from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { CATEGORY_TILES, perksCountLabel } from '@shared/categories'
import { getOffersByCategory, type OfferDocument } from '@shared/firebase/offers'
import { DEFAULT_PERK_SORT, filterAndSortPerks, parseCategoryFilter, type PerkSort } from '@shared/perks/perksFilter'
import { useDebouncedValue } from '@shared/useDebouncedValue'
import AppText from '../../components/AppText'
import LineIcon from '../../components/LineIcon'
import Notice from '../../components/Notice'
import OfferCard from '../../components/OfferCard'
import PerksSearchField from '../../components/PerksSearchField'
import SortSheet from '../../components/SortSheet'
import { useLang } from '../../i18n/LangProvider'
import { openOffer } from '../../lib/openOffer'
import { webOnly } from '../../lib/webStyles'
import { colors, radius, type } from '../../theme'

// A category "folder" (web: /categories/[category]), pushed over the tabs
// from the Perks grid or Home's category rail as a page flip
// (lib/pageFlip.ts): a full-screen swipe in the reading direction turns it
// back to where it was opened, the same as the back button. Search and Sort
// work within the category, through the same pipeline as the Perks tab.
export default function CategoryScreen() {
  const { t, lang, isRtl } = useLang()
  const { category: rawCategory } = useLocalSearchParams<{ category: string }>()
  // Canonical name for any spelling of a known category (`Beach+and+Sea`
  // arrives undecoded), so the tile and the Firestore query both match.
  const parsedCategory = parseCategoryFilter(rawCategory)
  const category = parsedCategory === 'all' ? (rawCategory ?? '') : parsedCategory
  const tile = CATEGORY_TILES.find((c) => c.category === category)
  const [offers, setOffers] = useState<OfferDocument[] | null>(null)
  const [failed, setFailed] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [query, setQuery] = useState('')
  // Filters as you type, settled by a short debounce; clearing is instant.
  const debouncedQuery = useDebouncedValue(query, 200)
  const appliedQuery = query ? debouncedQuery : ''
  const [sort, setSort] = useState<PerkSort>(DEFAULT_PERK_SORT)

  const fetchOffers = useCallback(() => getOffersByCategory(category), [category])
  // The fetch is already one category, so the pipeline only searches and sorts.
  const visible = useMemo(
    () => (offers ? filterAndSortPerks(offers, { query: appliedQuery, category: 'all', sort }, t, lang) : []),
    // `t` changes identity every render; `lang` covers what it depends on.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [offers, appliedQuery, sort, lang]
  )

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
  }, [fetchOffers])

  const onRefresh = async () => {
    setRefreshing(true)
    try {
      setOffers(await fetchOffers())
      setFailed(false)
    } catch {
      setFailed(true)
    }
    setRefreshing(false)
  }

  // Opened from a deep link with nothing under it: back lands on the grid.
  const goBack = () => {
    if (router.canGoBack()) router.back()
    else router.replace('/perks')
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.bar}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('cats_detail_back')}
          onPress={goBack}
          hitSlop={8}
          style={({ pressed }) => [styles.back, pressed && styles.backPressed]}
        >
          <LineIcon name="chevronStart" size={22} color={colors.brand} strokeWidth={2.2} flip={isRtl} />
          <AppText style={styles.backLabel} numberOfLines={1}>
            {t('cats_detail_back')}
          </AppText>
        </Pressable>
      </View>
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
            <View style={styles.titleRow}>
              <View style={styles.emojiBox}>
                <AppText style={styles.emoji} accessibilityElementsHidden importantForAccessibility="no">
                  {tile?.emoji ?? '🏷️'}
                </AppText>
              </View>
              <View style={styles.titleText}>
                <AppText accessibilityRole="header" style={type.screenTitle}>
                  {tile ? t(tile.labelKey) : category}
                </AppText>
                {offers ? (
                  <AppText style={styles.count}>{perksCountLabel(offers.length, t)}</AppText>
                ) : (
                  !failed && <View style={styles.countPlaceholder} />
                )}
              </View>
            </View>
            {!!offers?.length && (
              <View style={styles.controls}>
                <PerksSearchField value={query} onChangeText={setQuery} />
                <SortSheet value={sort} onChange={setSort} />
              </View>
            )}
            {failed && <Notice message={t('mobile_load_error')} />}
          </View>
        }
        ListEmptyComponent={
          offers === null ? (
            failed ? null : <ActivityIndicator color={colors.brand} style={styles.spinner} />
          ) : offers.length > 0 ? (
            <View style={styles.empty} accessibilityLiveRegion="polite">
              <AppText style={styles.emptyTitle}>{t('cats_search_no_results_sub')}</AppText>
            </View>
          ) : (
            <View style={styles.empty}>
              <AppText style={styles.emptyTitle}>{t('deals_empty_title')}</AppText>
              <AppText style={styles.emptySub}>{t('deals_empty_sub')}</AppText>
            </View>
          )
        }
      />
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  // The back button sits on the leading side; the row flips with the root direction.
  bar: { flexDirection: 'row', alignItems: 'center', minHeight: 52, paddingHorizontal: 8 },
  back: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    minHeight: 44,
    paddingStart: 4,
    paddingEnd: 12,
    borderRadius: radius.pill,
    ...webOnly({ cursor: 'pointer' }),
  },
  backPressed: { backgroundColor: colors.borderLight },
  backLabel: { fontSize: 16, fontWeight: '600', color: colors.brand },
  content: { paddingHorizontal: 16, paddingTop: 4, paddingBottom: 24, flexGrow: 1 },
  header: { marginBottom: 16, gap: 14 },
  controls: { flexDirection: 'row', alignItems: 'center', gap: 8 },
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
  emoji: { fontSize: 32, lineHeight: 40, textAlign: 'center' },
  titleText: { flex: 1, minWidth: 0, gap: 2 },
  count: { fontSize: 14, lineHeight: 20, color: colors.textMuted },
  countPlaceholder: { height: 12, width: 110, marginTop: 6, borderRadius: radius.pill, backgroundColor: colors.borderLight },
  spinner: { marginTop: 48 },
  empty: { alignItems: 'center', marginTop: 48, paddingHorizontal: 24 },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: colors.heading, textAlign: 'center', marginBottom: 4 },
  emptySub: { fontSize: 14, color: colors.body, textAlign: 'center' },
})

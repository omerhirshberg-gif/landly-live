import { memo, useMemo, useState } from 'react'
import { Pressable, StyleSheet, TextInput, useWindowDimensions, View } from 'react-native'
import type { OfferDocument } from '@shared/firebase/offers'
import { chainsByCategory, keepRaayonitFilter } from '@shared/offers/discoverTab'
import { raayonitCategoryName, type RaayonitCategoryId } from '@shared/offers/raayonitCategories'
import { normalizeQuery } from '@shared/perks/perksFilter'
import { availableRegionFilters, chainMatchesSearch, matchesRegionFilter, nearMe, NEAR_ME_RADIUS_KM, RAAYONIT_REGION_LABEL_KEYS } from '@shared/offers/raayonitRegions'
import { raayonitRows, RAAYONIT_MORE_ROW } from '@shared/offers/raayonitRows'
import { isolateLtr } from '@shared/home/superShowcase'
import AppText from './AppText'
import ChainTile from './ChainTile'
import LineIcon from './LineIcon'
import RaayonitCategoryRail from './RaayonitCategoryRail'
import RaayonitCategorySheet from './RaayonitCategorySheet'
import RaayonitFilterSheet, { NO_RAAYONIT_FILTERS, raayonitFilterCount, type RaayonitFilterValues } from './RaayonitFilterSheet'
import { useLang } from '../i18n/LangProvider'
import { webOnly } from '../lib/webStyles'
import { colors } from '../theme'

// "Where to redeem" (web: components/raayonit/RaayonitTab.tsx): a title, one search field with a Filter button beside it (Category and Region
// live in the button's bottom sheet, RaayonitFilterSheet.tsx), a summary bar with "Clear filters" while any filter is on, the live result
// count and a grid of framed venue cards. Tapping a card opens its page. `initialCategory` (?category=) pre-selects a category; `initialQuery` (?q=) fills the search.
export default memo(function RaayonitTab({ offers, initialCategory, initialQuery }: { offers: OfferDocument[]; initialCategory?: string; initialQuery?: string }) {
  const { t, lang, isRtl } = useLang()
  const [filters, setFilters] = useState<RaayonitFilterValues>({ ...NO_RAAYONIT_FILTERS, category: (initialCategory as RaayonitCategoryId | undefined) ?? 'all' })
  const [query, setQuery] = useState(initialQuery ?? '')
  const q = normalizeQuery(query)
  const allGroups = useMemo(() => chainsByCategory(offers, lang, { membership: true }), [offers, lang])
  const regions = useMemo(() => availableRegionFilters(offers), [offers])
  const category = keepRaayonitFilter(filters.category, allGroups)
  const region = regions.includes(filters.region) ? filters.region : 'all'
  const [openId, setOpenId] = useState<string | null>(null)
  const near = filters.near
  const { visible, groups } = useMemo(() => {
    const byRegion = near ? nearMe(offers, near) : region === 'all' ? offers : offers.filter((o) => matchesRegionFilter(o, region))
    const bySearch = q ? byRegion.filter((o) => chainMatchesSearch(o, q, t, lang)) : byRegion
    const grouped = chainsByCategory(bySearch, lang, { membership: true })
    const picked = category === 'all' ? grouped : grouped.filter((g) => g.id === category)
    // Near me lists the venues themselves, nearest first, not the category groups' alphabetical order.
    return { visible: near ? bySearch.filter((o) => picked.some((g) => g.offers.includes(o))) : [...new Map(picked.flatMap((g) => g.offers).map((o) => [o.id, o] as const)).values()], groups: picked }
  }, [offers, region, near, q, category, t, lang])
  // Browsing (no search, no category) is one row per category; a search or a picked category lists the matches as a grid.
  const rows = !q && category === 'all' && !near
  const rowList = useMemo(() => raayonitRows(groups), [groups])
  const rowTitle = (id: string) => (id === RAAYONIT_MORE_ROW ? t('raayonit_row_more') : raayonitCategoryName(id as RaayonitCategoryId, lang))
  const openRow = openId ? rowList.find((r) => r.id === openId) : undefined
  const active: RaayonitFilterValues = { category, region, near }
  const count = raayonitFilterCount(active)
  const summary = [category !== 'all' ? raayonitCategoryName(category, lang) : null, near ? `${t('geo_near_me_btn')} · ${NEAR_ME_RADIUS_KM} ${lang === 'he' ? 'ק״מ' : lang === 'ru' ? 'км' : 'km'}` : region !== 'all' ? t(RAAYONIT_REGION_LABEL_KEYS[region]) : null].filter(Boolean).join(' · ')
  const { width } = useWindowDimensions()
  const cellPct = width >= 1280 ? '18.6%' : width >= 900 ? '23.8%' : '48%'
  return (
    <View>
      <AppText accessibilityRole="header" style={styles.title}>{t('raayonit_where_title')}</AppText>
      <View style={styles.toolbar}>
        <View style={styles.search}>
          <LineIcon name="search" size={16} color={colors.textFaint} strokeWidth={2} />
          <TextInput value={query} onChangeText={setQuery} placeholder={t('raayonit_search_business')} placeholderTextColor={colors.textFaint} style={[styles.input, { textAlign: isRtl ? 'right' : 'left' }]} accessibilityLabel={t('raayonit_search_business')} returnKeyType="search" />
        </View>
      </View>
      <View style={styles.buttons}>
        <View style={styles.buttonSlot}>
          <RaayonitFilterSheet
            values={active}
            onApply={setFilters}
            categories={allGroups.map((g) => ({ id: g.id, label: raayonitCategoryName(g.id, lang) }))}
            regions={regions}
          />
        </View>
        {regions.length > 1 && (
          <View style={styles.buttonSlot}>
            <RaayonitFilterSheet mode="region" values={active} onApply={setFilters} categories={[]} regions={regions} />
          </View>
        )}
      </View>
      {count > 0 && (
        <View style={styles.summary}>
          <AppText autoDir numberOfLines={1} style={styles.summaryText}>{summary}</AppText>
          <Pressable accessibilityRole="button" onPress={() => setFilters(NO_RAAYONIT_FILTERS)} hitSlop={8} style={styles.clear}>
            <AppText style={styles.clearText}>{t('raayonit_filter_clear')}</AppText>
          </Pressable>
        </View>
      )}
      <AppText accessibilityLiveRegion="polite" style={styles.results}>{t('raayonit_results').replace('{count}', isolateLtr(String(visible.length)))}</AppText>
      {visible.length === 0 ? (
        <AppText style={styles.empty}>{t('raayonit_no_results')}</AppText>
      ) : rows ? (
        rowList.map((row, i) => <RaayonitCategoryRail key={row.id} divider={i > 0} title={rowTitle(row.id)} offers={row.offers} hasMore={row.hasMore} onShowAll={() => setOpenId(row.id)} />)
      ) : (
        <View style={styles.grid}>{visible.map((o) => <View key={o.id} style={{ width: cellPct }}><ChainTile offer={o} /></View>)}</View>
      )}
      {openRow && <RaayonitCategorySheet title={rowTitle(openRow.id)} offers={openRow.all} onClose={() => setOpenId(null)} />}
    </View>
  )
})

const styles = StyleSheet.create({
  title: { marginTop: 28, fontSize: 22, fontWeight: '800', letterSpacing: -0.5, color: colors.heading },
  // The search takes the full width, so its placeholder reads whole; Filter and Location share the row below, equal in width.
  toolbar: { flexDirection: 'row', alignItems: 'center', marginTop: 14 },
  buttons: { flexDirection: 'row', gap: 8, marginTop: 8 },
  buttonSlot: { flex: 1, minWidth: 0 },
  search: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 8, height: 44, paddingHorizontal: 14, borderRadius: 14, borderCurve: 'continuous', backgroundColor: '#F1F5F9' },
  input: { flex: 1, fontSize: 15, color: colors.textStrong, paddingVertical: 0, ...webOnly({ outlineStyle: 'none' }) },
  summary: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 12, paddingHorizontal: 12, minHeight: 40, borderRadius: 12, borderCurve: 'continuous', backgroundColor: colors.brandTint },
  summaryText: { flex: 1, fontSize: 13, fontWeight: '600', color: colors.brand },
  clear: { minHeight: 40, justifyContent: 'center', ...webOnly({ cursor: 'pointer' }) },
  clearText: { fontSize: 13, fontWeight: '700', color: colors.brand, textDecorationLine: 'underline' },
  results: { marginTop: 16, fontSize: 14, fontWeight: '700', color: colors.heading },
  empty: { fontSize: 14, color: colors.textMuted, textAlign: 'center', paddingVertical: 28 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 12 },
})

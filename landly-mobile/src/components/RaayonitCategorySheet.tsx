import { useMemo, useState } from 'react'
import { Modal, Pressable, ScrollView, StyleSheet, TextInput, useWindowDimensions, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import type { OfferDocument } from '@shared/firebase/offers'
import { isolateLtr } from '@shared/home/superShowcase'
import { normalizeQuery } from '@shared/perks/perksFilter'
import { raayonitCategoriesOf, raayonitCategoryName, raayonitCategoryOf, type RaayonitCategoryId } from '@shared/offers/raayonitCategories'
import { chainMatchesSearch } from '@shared/offers/raayonitRegions'
import AppText from './AppText'
import ChainTile from './ChainTile'
import LineIcon from './LineIcon'
import SheetSlot, { SCRIM_COLOR, useSheetBounds } from './SheetSlot'
import { useLang } from '../i18n/LangProvider'
import { webOnly } from '../lib/webStyles'
import { colors } from '../theme'

// A category's full list (web: components/raayonit/RaayonitCategoryDialog.tsx), opened by its row's "Show all": a bottom sheet with the category
// name and count, a close button and the venues in a two-column grid (wider windows get more columns).
export default function RaayonitCategorySheet({ title, offers, onClose }: { title: string; offers: OfferDocument[]; onClose: () => void }) {
  const { t, lang, isRtl } = useLang()
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState<RaayonitCategoryId | 'all'>('all')
  // A list spanning several categories (the details screen's every business) can be narrowed by category; one category's own list has nothing to narrow.
  const categories = useMemo(() => [...new Set(offers.map((o) => raayonitCategoryOf(o)))], [offers])
  const q = normalizeQuery(query)
  const shown = useMemo(() => offers.filter((o) => (category === 'all' || raayonitCategoriesOf(o).includes(category)) && chainMatchesSearch(o, q, t, lang)), [offers, category, q, t, lang])
  const insets = useSafeAreaInsets()
  const bounds = useSheetBounds()
  const { width } = useWindowDimensions()
  const cols = width >= 900 ? 4 : width >= 600 ? 3 : 2
  return (
    <Modal visible transparent animationType="fade" statusBarTranslucent navigationBarTranslucent onRequestClose={onClose}>
      <Pressable style={styles.scrim} onPress={onClose} accessibilityRole="button" accessibilityLabel={t('avatar_cancel')} />
      <SheetSlot>
        <View style={[styles.sheet, bounds, { paddingBottom: insets.bottom + 8, direction: isRtl ? 'rtl' : 'ltr' }]} accessibilityViewIsModal>
          <View style={styles.handle} />
          <View style={styles.head}>
            <AppText accessibilityRole="header" autoDir numberOfLines={2} style={styles.title}>{`${title} (${isolateLtr(String(shown.length))})`}</AppText>
            <Pressable accessibilityRole="button" accessibilityLabel={t('avatar_cancel')} onPress={onClose} hitSlop={8} style={styles.close}>
              <LineIcon name="close" size={20} color={colors.textMuted} strokeWidth={2} />
            </Pressable>
          </View>
          <View style={styles.search}>
            <LineIcon name="search" size={16} color={colors.textFaint} strokeWidth={2} />
            <TextInput value={query} onChangeText={setQuery} placeholder={t('raayonit_search_business')} placeholderTextColor={colors.textFaint} style={[styles.input, { textAlign: isRtl ? 'right' : 'left' }]} accessibilityLabel={t('raayonit_search_business')} returnKeyType="search" />
          </View>
          {categories.length > 1 && (
            <ScrollView horizontal showsVerticalScrollIndicator={false} showsHorizontalScrollIndicator={false} style={styles.pillScroll} contentContainerStyle={styles.pills}>
              {(['all', ...categories] as const).map((id) => (
                <Pressable key={id} accessibilityRole="radio" accessibilityState={{ selected: category === id, checked: category === id }} onPress={() => setCategory(id)} style={[styles.pill, category === id && styles.pillOn]}>
                  <AppText numberOfLines={1} style={[styles.pillText, category === id && styles.pillTextOn]}>{id === 'all' ? t('cats_all_categories') : raayonitCategoryName(id, lang)}</AppText>
                </Pressable>
              ))}
            </ScrollView>
          )}
          {shown.length === 0 && <AppText accessibilityLiveRegion="polite" style={styles.empty}>{t('raayonit_no_results')}</AppText>}
          <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} showsHorizontalScrollIndicator={false} contentContainerStyle={styles.grid}>
            {shown.map((o) => <View key={o.id} style={{ width: `${100 / cols - 2}%` }}><ChainTile offer={o} /></View>)}
          </ScrollView>
        </View>
      </SheetSlot>
    </Modal>
  )
}

const styles = StyleSheet.create({
  scrim: { flex: 1, backgroundColor: SCRIM_COLOR },
  sheet: { backgroundColor: colors.white, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingTop: 8, maxHeight: '92%', ...webOnly({ width: '100%', maxWidth: 960, alignSelf: 'center' }) },
  handle: { alignSelf: 'center', width: 32, height: 4, borderRadius: 2, backgroundColor: colors.textFaint, marginBottom: 8 },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingHorizontal: 20, paddingBottom: 10 },
  title: { flex: 1, fontSize: 18, fontWeight: '800', letterSpacing: -0.3, color: colors.heading },
  close: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 22 },
  search: { flexDirection: 'row', alignItems: 'center', gap: 8, height: 44, marginHorizontal: 16, marginBottom: 10, paddingHorizontal: 14, borderRadius: 14, borderCurve: 'continuous', backgroundColor: '#F1F5F9' },
  input: { flex: 1, minWidth: 0, fontSize: 15, color: colors.heading, paddingVertical: 0, ...webOnly({ outlineStyle: 'none' }) },
  pillScroll: { flexGrow: 0, marginBottom: 10 },
  pills: { gap: 8, paddingHorizontal: 16 },
  pill: { minHeight: 36, paddingHorizontal: 14, justifyContent: 'center', borderRadius: 999, borderWidth: 1, borderColor: '#E2E8F0', backgroundColor: colors.white },
  pillOn: { borderColor: colors.brand, backgroundColor: colors.brand },
  pillText: { fontSize: 13, fontWeight: '600', color: '#334155' },
  pillTextOn: { color: '#FFFFFF' },
  empty: { paddingVertical: 24, textAlign: 'center', fontSize: 14, color: colors.textMuted },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 12, paddingHorizontal: 16, paddingBottom: 12 },
})

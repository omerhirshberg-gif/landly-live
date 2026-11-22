import { useState } from 'react'
import { Modal, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { DEFAULT_PERK_SORT, PERK_SORTS, PERK_SORT_LABELS, type CategoryFilter, type PerkSort } from '@shared/perks/perksFilter'
import { OFFER_KINDS, OFFER_KIND_LABELS, type OfferKind } from '@shared/offers/offerKind'
import AppText from './AppText'
import SheetSlot, { SCRIM_COLOR, useSheetBounds } from './SheetSlot'
import LineIcon from './LineIcon'
import ScalePressable from './ScalePressable'
import { useLang } from '../i18n/LangProvider'
import { tick } from '../lib/haptics'
import { webOnly } from '../lib/webStyles'
import { colors, radius } from '../theme'

/** What the sheet offers to narrow by, with how many perks each choice leaves (counted over the loaded offers). */
export interface FilterFacets {
  kinds: Record<OfferKind, number>
  categories: { key: CategoryFilter; label: string; count: number }[]
}

export interface FilterValues {
  sort: PerkSort
  kind: OfferKind | 'all'
  category: CategoryFilter
  /** Set only by a brand page's deep link (?brand=): there is no brand picker, but Reset clears it. */
  brand: string
}

const DEFAULT_VALUES: FilterValues = { sort: DEFAULT_PERK_SORT, kind: 'all', category: 'all', brand: '' }
/** Chips shown before "Show all". */
const CHIPS_FOLDED = 8

// The "Filter & sort" button beside the search field (web: components/perks/PerksFilterMenu.tsx): a white pill with a sliders
// glyph that opens one short bottom sheet: Sort by (radios), Offer type, and Category (chips with live counts, folded behind
// "Show all"; left out on a single-category screen). Location has its own button and sheet (LocationSheet.tsx). The picks
// are a draft until the sticky footer's "Show results" applies them; "Reset" clears the draft. A count badge says how much is set.
export default function FilterSheet({
  values,
  onApply,
  facets,
  hideCategory = false,
}: {
  values: FilterValues
  onApply: (next: FilterValues) => void
  facets: FilterFacets
  /** A category's own screen is already one category. */
  hideCategory?: boolean
}) {
  const { t } = useLang()
  const [open, setOpen] = useState(false)
  // Each opening mounts the sheet afresh, so its draft starts from what is applied.
  const [session, setSession] = useState(0)
  const count = Number(values.sort !== DEFAULT_PERK_SORT) + Number(values.kind !== 'all') + Number(values.category !== 'all') + Number(!!values.brand)
  const active = count > 0
  return (
    <>
      <ScalePressable
        pressedScale={0.95}
        accessibilityRole="button"
        accessibilityLabel={`${t('filter_sort_trigger')}${active ? ` (${count})` : ''}`}
        accessibilityState={{ expanded: open }}
        hitSlop={{ top: 5, bottom: 5 }}
        onPress={() => { setSession((n) => n + 1); setOpen(true) }}
        style={[styles.trigger, active && styles.triggerActive]}
      >
        <LineIcon name="sliders" size={16} color={active ? colors.brand : colors.text} strokeWidth={1.75} />
        <AppText style={[styles.triggerLabel, active && styles.triggerLabelActive]}>{t('filter_sort_trigger')}</AppText>
        {active && (
          <View style={styles.badge}>
            <AppText ltr style={styles.badgeText}>{String(count)}</AppText>
          </View>
        )}
      </ScalePressable>
      <FilterModal key={session} visible={open} values={values} onApply={onApply} facets={facets} hideCategory={hideCategory} onClose={() => setOpen(false)} />
    </>
  )
}

function FilterModal({ visible, values, onApply, facets, hideCategory, onClose }: { visible: boolean; values: FilterValues; onApply: (next: FilterValues) => void; facets: FilterFacets; hideCategory: boolean; onClose: () => void }) {
  const { t, isRtl } = useLang()
  const insets = useSafeAreaInsets()
  const bounds = useSheetBounds()
  // The picks are a draft until "Show results"; it starts from what is applied each time the sheet opens.
  const [draft, setDraft] = useState<FilterValues>(values)
  const [allCategories, setAllCategories] = useState(false)
  const commit = () => { onApply(draft); onClose() }
  const chip = (key: string, label: string, selected: boolean, onPress: () => void, count?: number) => (
    <Pressable
      key={key}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={() => { tick(); onPress() }}
      style={({ pressed }) => [styles.chip, selected && styles.chipSelected, pressed && styles.chipPressed]}
    >
      <AppText style={[styles.chipText, selected && styles.chipTextSelected]} numberOfLines={1}>{label}</AppText>
      {count !== undefined && <AppText ltr style={[styles.chipCount, selected && styles.chipTextSelected]}>{`(${count})`}</AppText>}
    </Pressable>
  )
  const row = (key: string, label: string, selected: boolean, onPress: () => void) => (
    <Pressable
      key={key}
      accessibilityRole="radio"
      accessibilityState={{ selected, checked: selected }}
      android_ripple={{ color: 'rgba(0, 56, 184, 0.12)' }}
      onPress={() => { tick(); onPress() }}
      style={({ pressed }) => [styles.row, pressed && Platform.OS === 'web' && styles.rowPressed]}
    >
      <AppText style={[styles.rowLabel, selected && styles.rowLabelSelected]}>{label}</AppText>
      {selected && <LineIcon name="check" size={20} color={colors.brand} strokeWidth={2.4} />}
    </Pressable>
  )
  const categories = allCategories ? facets.categories : facets.categories.slice(0, CHIPS_FOLDED)
  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent navigationBarTranslucent onRequestClose={onClose}>
      <Pressable style={styles.scrim} onPress={onClose} accessibilityRole="button" accessibilityLabel={t('avatar_cancel')} />
      <SheetSlot>
        <View style={[styles.sheet, bounds, { paddingBottom: insets.bottom + 8, direction: isRtl ? 'rtl' : 'ltr' }]} accessibilityViewIsModal>
          <View style={styles.handle} />
          <ScrollView showsVerticalScrollIndicator={false} showsHorizontalScrollIndicator={false}>
            <AppText accessibilityRole="header" style={styles.sectionTitle}>{t('filter_sort_by')}</AppText>
            {PERK_SORTS.map((value) => row(value, t(PERK_SORT_LABELS[value]), value === draft.sort, () => setDraft((d) => ({ ...d, sort: value }))))}
            <AppText accessibilityRole="header" style={styles.sectionTitle}>{t('filter_offer_type')}</AppText>
            <View style={styles.chips}>
              {OFFER_KINDS.filter((k) => facets.kinds[k] > 0 || draft.kind === k).map((k) => chip(k, t(OFFER_KIND_LABELS[k]), draft.kind === k, () => setDraft((d) => ({ ...d, kind: d.kind === k ? 'all' : k })), facets.kinds[k]))}
            </View>
            {!hideCategory && <>
            <AppText accessibilityRole="header" style={styles.sectionTitle}>{t('filter_category')}</AppText>
            <View style={styles.chips}>
              {categories.map((c) => chip(c.key, c.label, draft.category === c.key, () => setDraft((d) => ({ ...d, category: d.category === c.key ? 'all' : c.key })), c.count))}
              {facets.categories.length > CHIPS_FOLDED && (
                <Pressable accessibilityRole="button" onPress={() => setAllCategories((v) => !v)} style={styles.moreLink}>
                  <AppText style={styles.moreText}>{t(allCategories ? 'filter_show_fewer' : 'filter_show_all')}</AppText>
                </Pressable>
              )}
            </View>
            </>}
          </ScrollView>
          {/* Sticky footer: the high-contrast action, and a plain text reset. */}
          <View style={styles.footer}>
            <Pressable accessibilityRole="button" onPress={() => setDraft(DEFAULT_VALUES)} hitSlop={8} style={styles.reset}>
              <AppText style={styles.resetText}>{t('filter_reset')}</AppText>
            </Pressable>
            <Pressable accessibilityRole="button" onPress={commit} style={({ pressed }) => [styles.apply, pressed && styles.applyPressed]}>
              <AppText style={styles.applyText}>{t('filter_show_results')}</AppText>
            </Pressable>
          </View>
        </View>
      </SheetSlot>
    </Modal>
  )
}

const styles = StyleSheet.create({
  trigger: {
    flexShrink: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 38,
    paddingHorizontal: 14,
    borderRadius: radius.pill,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    ...webOnly({ cursor: 'pointer', userSelect: 'none' }),
  },
  triggerActive: { borderColor: colors.brand },
  triggerLabel: { flexShrink: 0, fontSize: 14, lineHeight: 20, fontWeight: '600', color: colors.text },
  triggerLabelActive: { color: colors.brand },
  badge: { minWidth: 18, height: 18, paddingHorizontal: 5, borderRadius: 9, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.brand },
  badgeText: { fontSize: 11, lineHeight: 14, fontWeight: '700', color: colors.white },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 24, paddingTop: 6, paddingBottom: 4 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 4, maxWidth: '100%', minHeight: 36, paddingHorizontal: 14, borderRadius: radius.pill, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border, ...webOnly({ cursor: 'pointer' }) },
  chipSelected: { backgroundColor: colors.brandTint, borderColor: colors.brand },
  chipPressed: { opacity: 0.7 },
  chipText: { flexShrink: 1, fontSize: 14, lineHeight: 20, fontWeight: '500', color: colors.text },
  chipTextSelected: { color: colors.brand, fontWeight: '700' },
  chipCount: { fontSize: 12, lineHeight: 16, color: colors.textMuted, fontVariant: ['tabular-nums'] },
  moreLink: { minHeight: 36, justifyContent: 'center', paddingHorizontal: 6, ...webOnly({ cursor: 'pointer' }) },
  moreText: { fontSize: 14, fontWeight: '700', color: colors.brand },
  footer: { flexDirection: 'row', alignItems: 'center', gap: 16, paddingHorizontal: 24, paddingTop: 12, paddingBottom: 4, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, backgroundColor: colors.surfaceContainer },
  reset: { minHeight: 48, justifyContent: 'center', ...webOnly({ cursor: 'pointer' }) },
  resetText: { fontSize: 15, fontWeight: '600', color: colors.body, textDecorationLine: 'underline' },
  apply: { flex: 1, minHeight: 48, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.heading, ...webOnly({ cursor: 'pointer' }) },
  applyPressed: { opacity: 0.85 },
  applyText: { fontSize: 16, fontWeight: '700', color: colors.white },
  scrim: { flex: 1, backgroundColor: SCRIM_COLOR },
  sheet: { backgroundColor: colors.surfaceContainer, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingTop: 8, maxHeight: '86%', ...webOnly({ width: '100%', maxWidth: 560, alignSelf: 'center' }) },
  handle: { alignSelf: 'center', width: 32, height: 4, borderRadius: 2, backgroundColor: colors.textFaint, marginBottom: 8 },
  sectionTitle: { fontSize: 17, fontWeight: '700', color: colors.heading, paddingHorizontal: 24, paddingTop: 12, paddingBottom: 4 },
  row: { minHeight: 52, paddingHorizontal: 24, flexDirection: 'row', alignItems: 'center', gap: 12, ...webOnly({ cursor: 'pointer' }) },
  rowPressed: { backgroundColor: 'rgba(0, 56, 184, 0.08)' },
  rowLabel: { flex: 1, fontSize: 16, fontWeight: '500', color: colors.heading },
  rowLabelSelected: { fontWeight: '700', color: colors.brand },
})

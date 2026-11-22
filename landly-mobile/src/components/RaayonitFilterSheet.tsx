import { useState } from 'react'
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import type { RaayonitCategoryId } from '@shared/offers/raayonitCategories'
import type { Coordinates } from '@shared/geo'
import { RAAYONIT_REGION_LABEL_KEYS, type RaayonitRegionFilter } from '@shared/offers/raayonitRegions'
import AppText from './AppText'
import LineIcon from './LineIcon'
import SheetSlot, { SCRIM_COLOR, useSheetBounds } from './SheetSlot'
import { useLang } from '../i18n/LangProvider'
import { tick } from '../lib/haptics'
import { useNearMe } from '../lib/useNearMe'
import { webOnly } from '../lib/webStyles'
import { colors, radius } from '../theme'

export interface RaayonitFilterValues {
  category: RaayonitCategoryId | 'all'
  region: RaayonitRegionFilter
  /** "Near me": the member's position, which limits the hub to venues within 5 km (nearest first). Replaces the region. */
  near: Coordinates | null
}
export const NO_RAAYONIT_FILTERS: RaayonitFilterValues = { category: 'all', region: 'all', near: null }
export const raayonitFilterCount = (v: RaayonitFilterValues): number => Number(v.category !== 'all') + Number(v.region !== 'all' || !!v.near)
/** Which group a button holds: the Filter button has the categories, the Location button the regions. */
export type RaayonitFilterMode = 'category' | 'region'

// The Raayonit hub's "Filter" button (web: the same control in components/raayonit/RaayonitFilterMenu.tsx): a rounded button with a sliders
// glyph and a count badge, beside the search field. It opens one bottom sheet with two groups, Category (Raayonit's categories) and
// Region, as selectable tiles. The picks are a draft until "Apply"; "Reset" clears the draft.
export default function RaayonitFilterSheet({
  values,
  onApply,
  categories,
  regions,
  mode = 'category',
}: {
  values: RaayonitFilterValues
  onApply: (next: RaayonitFilterValues) => void
  categories: { id: RaayonitCategoryId; label: string }[]
  regions: RaayonitRegionFilter[]
  mode?: RaayonitFilterMode
}) {
  const { t } = useLang()
  const label = t(mode === 'region' ? 'raayonit_location_btn' : 'raayonit_filter_btn')
  const [open, setOpen] = useState(false)
  // Each opening mounts the sheet afresh, so its draft starts from what is applied.
  const [session, setSession] = useState(0)
  const count = mode === 'region' ? Number(values.region !== 'all' || !!values.near) : Number(values.category !== 'all')
  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label}${count > 0 ? ` (${count})` : ''}`}
        accessibilityState={{ expanded: open }}
        onPress={() => { setSession((n) => n + 1); setOpen(true) }}
        style={({ pressed }) => [styles.trigger, count > 0 && styles.triggerOn, pressed && styles.pressed]}
      >
        <LineIcon name={mode === 'region' ? 'pin' : 'sliders'} size={16} color={count > 0 ? colors.brand : colors.textStrong} strokeWidth={1.75} />
        <AppText style={[styles.triggerLabel, count > 0 && styles.triggerLabelOn]}>{label}</AppText>
        {count > 0 && <View style={styles.badge}><AppText ltr style={styles.badgeText}>{String(count)}</AppText></View>}
      </Pressable>
      <SheetModal key={session} visible={open} values={values} onApply={onApply} categories={categories} regions={regions} mode={mode} onClose={() => setOpen(false)} />
    </>
  )
}

function SheetModal({ visible, values, onApply, categories, regions, mode, onClose }: { mode: RaayonitFilterMode; visible: boolean; values: RaayonitFilterValues; onApply: (next: RaayonitFilterValues) => void; categories: { id: RaayonitCategoryId; label: string }[]; regions: RaayonitRegionFilter[]; onClose: () => void }) {
  const { t, isRtl } = useLang()
  const insets = useSafeAreaInsets()
  const bounds = useSheetBounds()
  const [draft, setDraft] = useState<RaayonitFilterValues>(values)
  const [geoError, setGeoError] = useState<string | null>(null)
  const { locate, state: geoState } = useNearMe({
    active: false,
    // The button itself turns location on and applies: the hub shows the venues within 5 km, nearest first.
    onLocate: (coords) => { onApply({ ...values, region: 'all', near: coords }); onClose() },
    onClear: () => {},
    onError: setGeoError,
  })
  const tile = (key: string, label: string, selected: boolean, onPress: () => void) => (
    <Pressable
      key={key}
      accessibilityRole="radio"
      accessibilityState={{ selected, checked: selected }}
      onPress={() => { tick(); onPress() }}
      style={({ pressed }) => [styles.tile, selected && styles.tileOn, pressed && styles.pressed]}
    >
      <AppText autoDir numberOfLines={2} style={[styles.tileText, selected && styles.tileTextOn]}>{label}</AppText>
      {selected && <LineIcon name="check" size={16} color={colors.brand} strokeWidth={2.4} />}
    </Pressable>
  )
  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent navigationBarTranslucent onRequestClose={onClose}>
      <Pressable style={styles.scrim} onPress={onClose} accessibilityRole="button" accessibilityLabel={t('avatar_cancel')} />
      <SheetSlot>
        <View style={[styles.sheet, bounds, { paddingBottom: insets.bottom + 8, direction: isRtl ? 'rtl' : 'ltr' }]} accessibilityViewIsModal>
          <View style={styles.handle} />
          <ScrollView showsVerticalScrollIndicator={false} showsHorizontalScrollIndicator={false}>
            {mode === 'category' && (<>
            <AppText accessibilityRole="header" style={styles.sectionTitle}>{t('filter_category')}</AppText>
            <View style={styles.grid}>
              {tile('all', t('raayonit_filter_all'), draft.category === 'all', () => setDraft((d) => ({ ...d, category: 'all' })))}
              {categories.map((c) => tile(c.id, c.label, draft.category === c.id, () => setDraft((d) => ({ ...d, category: c.id }))))}
            </View>
            </>)}
            {mode === 'region' && regions.length > 1 && (
              <>
                <AppText accessibilityRole="header" style={styles.sectionTitle}>{t('raayonit_region_label')}</AppText>
                <View style={styles.grid}>
                  <Pressable accessibilityRole="button" disabled={geoState === 'requesting'} onPress={locate} style={({ pressed }) => [styles.nearMe, pressed && styles.pressed]}>
                    <LineIcon name="navigation" size={16} color={colors.brand} strokeWidth={1.75} />
                    <AppText numberOfLines={1} style={styles.nearMeText}>{t('geo_near_me_current')}</AppText>
                    {values.near && <LineIcon name="check" size={16} color={colors.brand} strokeWidth={2.4} />}
                  </Pressable>
                  {geoError && <AppText accessibilityLiveRegion="polite" style={styles.geoError}>{geoError}</AppText>}
                  {regions.map((r) => tile(r, t(RAAYONIT_REGION_LABEL_KEYS[r]), draft.region === r && !draft.near, () => setDraft((d) => ({ ...d, region: r, near: null }))))}
                </View>
              </>
            )}
          </ScrollView>
          <View style={styles.footer}>
            <Pressable accessibilityRole="button" onPress={() => setDraft((d) => (mode === 'region' ? { ...d, region: 'all', near: null } : { ...d, category: 'all' }))} hitSlop={8} style={styles.reset}>
              <AppText style={styles.resetText}>{t('raayonit_filter_reset')}</AppText>
            </Pressable>
            <Pressable accessibilityRole="button" onPress={() => { onApply(draft); onClose() }} style={({ pressed }) => [styles.apply, pressed && styles.pressed]}>
              <AppText style={styles.applyText}>{t('raayonit_filter_apply')}</AppText>
            </Pressable>
          </View>
        </View>
      </SheetSlot>
    </Modal>
  )
}

const styles = StyleSheet.create({
  trigger: { flexGrow: 1, flexShrink: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, height: 44, paddingHorizontal: 14, borderRadius: 14, borderCurve: 'continuous', backgroundColor: colors.white, borderWidth: 1, borderColor: '#E2E8F0', ...webOnly({ cursor: 'pointer', userSelect: 'none' }) },
  triggerOn: { borderColor: colors.brand },
  triggerLabel: { fontSize: 14, lineHeight: 20, fontWeight: '600', color: colors.textStrong },
  triggerLabelOn: { color: colors.brand },
  badge: { minWidth: 18, height: 18, paddingHorizontal: 5, borderRadius: 9, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.brand },
  badgeText: { fontSize: 11, lineHeight: 14, fontWeight: '700', color: colors.white },
  pressed: { opacity: 0.75 },
  scrim: { flex: 1, backgroundColor: SCRIM_COLOR },
  sheet: { backgroundColor: colors.white, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingTop: 8, maxHeight: '86%', ...webOnly({ width: '100%', maxWidth: 560, alignSelf: 'center' }) },
  handle: { alignSelf: 'center', width: 32, height: 4, borderRadius: 2, backgroundColor: colors.textFaint, marginBottom: 8 },
  sectionTitle: { fontSize: 17, fontWeight: '700', color: colors.heading, paddingHorizontal: 20, paddingTop: 14, paddingBottom: 8 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 20 },
  tile: { width: '48.5%', minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, borderCurve: 'continuous', borderWidth: 1, borderColor: '#E2E8F0', backgroundColor: colors.white, ...webOnly({ cursor: 'pointer' }) },
  nearMe: { width: '100%', minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, borderRadius: 12, borderCurve: 'continuous', borderWidth: 1, borderStyle: 'dashed', borderColor: colors.brand, backgroundColor: colors.brandTint },
  nearMeText: { flex: 1, fontSize: 14, fontWeight: '600', color: colors.brand },
  geoError: { width: '100%', fontSize: 12, color: colors.textMuted },
  tileOn: { borderColor: colors.brand, backgroundColor: colors.brandTint },
  tileText: { flex: 1, fontSize: 14, lineHeight: 18, fontWeight: '500', color: colors.textStrong },
  tileTextOn: { color: colors.brand, fontWeight: '700' },
  footer: { flexDirection: 'row', alignItems: 'center', gap: 16, paddingHorizontal: 20, paddingTop: 12, paddingBottom: 4, marginTop: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, backgroundColor: colors.white },
  reset: { minHeight: 48, justifyContent: 'center', ...webOnly({ cursor: 'pointer' }) },
  resetText: { fontSize: 15, fontWeight: '600', color: colors.body, textDecorationLine: 'underline' },
  apply: { flex: 1, minHeight: 48, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.heading, ...webOnly({ cursor: 'pointer' }) },
  applyText: { fontSize: 16, fontWeight: '700', color: colors.white },
})

import { useState } from 'react'
import { Modal, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import type { Coordinates } from '@shared/geo'
import { ISRAEL_REGIONS } from '@shared/israelCities'
import { DEFAULT_PERK_SORT, PERK_SORTS, PERK_SORT_LABELS, type PerkSort } from '@shared/perks/perksFilter'
import type { LocationFilter } from '@shared/perks/locationFilter'
import AppText from './AppText'
import { AreaPickerSheet } from './LocationFilterBar'
import { useNearMe } from './NearMeButton'
import SheetSlot, { SCRIM_COLOR, useSheetBounds } from './SheetSlot'
import LineIcon from './LineIcon'
import ScalePressable from './ScalePressable'
import { useLang } from '../i18n/LangProvider'
import { webOnly } from '../lib/webStyles'
import { chipShadow, colors, radius } from '../theme'

type Area = Extract<LocationFilter, { kind: 'area' }>
export interface FilterLocation {
  filter: LocationFilter | null
  onLocate: (coords: Coordinates) => void
  onArea: (area: Area) => void
  onClear: () => void
  onError: (message: string | null) => void
}

// The "Filter" chip beside the search field (web: components/perks/PerksFilterMenu.tsx): one bottom sheet with the sort order (where the
// screen has one) and the "Area / Location" section: Near me (the device's GPS), All of Israel, the regions, and any other city. It
// fills brand blue with a count of what is set (a non-default sort, a location), so an active location filter is always visible.
export default function FilterSheet({ sort, onSort, location }: { sort?: PerkSort; onSort?: (next: PerkSort) => void; location: FilterLocation }) {
  const { t } = useLang()
  const [open, setOpen] = useState(false)
  const count = Number(sort !== undefined && sort !== DEFAULT_PERK_SORT) + Number(!!location.filter)
  const active = count > 0
  return (
    <>
      <ScalePressable
        pressedScale={0.95}
        accessibilityRole="button"
        accessibilityLabel={`${t('cats_filter_button')}${active ? ` (${count})` : ''}`}
        accessibilityState={{ expanded: open }}
        hitSlop={{ top: 5, bottom: 5 }}
        onPress={() => setOpen(true)}
        style={[styles.trigger, active && styles.triggerActive]}
      >
        <LineIcon name="sort" size={16} color={active ? colors.white : colors.text} />
        <AppText style={[styles.triggerLabel, active && styles.triggerLabelActive]}>{t('cats_filter_button')}</AppText>
        {active && (
          <View style={styles.badge}>
            <AppText ltr style={styles.badgeText}>{String(count)}</AppText>
          </View>
        )}
      </ScalePressable>
      <FilterModal visible={open} sort={sort} onSort={onSort} location={location} onClose={() => setOpen(false)} />
    </>
  )
}

function FilterModal({ visible, sort, onSort, location, onClose }: { visible: boolean; sort?: PerkSort; onSort?: (next: PerkSort) => void; location: FilterLocation; onClose: () => void }) {
  const { t, lang, isRtl } = useLang()
  const insets = useSafeAreaInsets()
  const bounds = useSheetBounds()
  const [cities, setCities] = useState(false)
  const { filter } = location
  const nearMe = useNearMe({ active: filter?.kind === 'gps', onLocate: (c) => { location.onLocate(c); onClose() }, onClear: location.onClear, onError: location.onError })
  const pickArea = (area: Area) => { location.onArea(area); onClose() }
  const row = (key: string, label: string, selected: boolean, onPress: () => void, icon?: 'locate' | 'pin') => (
    <Pressable
      key={key}
      accessibilityRole="radio"
      accessibilityState={{ selected, checked: selected }}
      android_ripple={{ color: 'rgba(0, 56, 184, 0.12)' }}
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && Platform.OS === 'web' && styles.rowPressed]}
    >
      {icon && <LineIcon name={icon} size={18} color={selected ? colors.brand : colors.textMuted} strokeWidth={1.75} />}
      <AppText style={[styles.rowLabel, selected && styles.rowLabelSelected]}>{label}</AppText>
      {selected && <LineIcon name="check" size={20} color={colors.brand} strokeWidth={2.4} />}
    </Pressable>
  )
  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent navigationBarTranslucent onRequestClose={onClose}>
      <Pressable style={styles.scrim} onPress={onClose} accessibilityRole="button" accessibilityLabel={t('avatar_cancel')} />
      <SheetSlot>
        <View style={[styles.sheet, bounds, { paddingBottom: insets.bottom + 8, direction: isRtl ? 'rtl' : 'ltr' }]} accessibilityViewIsModal>
          <View style={styles.handle} />
          <ScrollView showsVerticalScrollIndicator={false} showsHorizontalScrollIndicator={false}>
            {sort !== undefined && onSort && (
              <>
                <AppText accessibilityRole="header" style={styles.sectionTitle}>{t('cats_sort_label')}</AppText>
                {PERK_SORTS.map((value) => row(value, t(PERK_SORT_LABELS[value]), value === sort, () => { onSort(value); onClose() }))}
              </>
            )}
            <AppText accessibilityRole="header" style={styles.sectionTitle}>{t('filter_area_title')}</AppText>
            {row('near', t('geo_near_me_current'), filter?.kind === 'gps', () => { void nearMe.locate() }, 'locate')}
            {row('all', t('loc_all_israel'), !filter, () => { if (filter) location.onClear(); onClose() }, 'pin')}
            {ISRAEL_REGIONS.map((r) => row(r.id, r.names[lang], filter?.kind === 'area' && !filter.city && filter.region === r.id, () => pickArea({ kind: 'area', region: r.id, city: null }), 'pin'))}
            {row('city', t('loc_other_city'), filter?.kind === 'area' && !!filter.city, () => setCities(true), 'pin')}
          </ScrollView>
          <AreaPickerSheet visible={cities} onClose={() => setCities(false)} onPick={(a) => { setCities(false); pickArea(a) }} />
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
    paddingHorizontal: 12,
    borderRadius: radius.chip,
    backgroundColor: colors.borderLight,
    ...webOnly({ cursor: 'pointer', userSelect: 'none' }),
  },
  triggerActive: { backgroundColor: colors.brand, ...chipShadow },
  triggerLabel: { flexShrink: 0, fontSize: 14, lineHeight: 20, fontWeight: '600', color: colors.text },
  triggerLabelActive: { color: colors.white },
  badge: { minWidth: 18, height: 18, paddingHorizontal: 5, borderRadius: 9, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.white },
  badgeText: { fontSize: 11, lineHeight: 14, fontWeight: '700', color: colors.brand },
  scrim: { flex: 1, backgroundColor: SCRIM_COLOR },
  sheet: { backgroundColor: colors.surfaceContainer, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingTop: 8, maxHeight: '86%', ...webOnly({ width: '100%', maxWidth: 560, alignSelf: 'center' }) },
  handle: { alignSelf: 'center', width: 32, height: 4, borderRadius: 2, backgroundColor: colors.textFaint, marginBottom: 8 },
  sectionTitle: { fontSize: 17, fontWeight: '700', color: colors.heading, paddingHorizontal: 24, paddingTop: 12, paddingBottom: 4 },
  row: { minHeight: 52, paddingHorizontal: 24, flexDirection: 'row', alignItems: 'center', gap: 12, ...webOnly({ cursor: 'pointer' }) },
  rowPressed: { backgroundColor: 'rgba(0, 56, 184, 0.08)' },
  rowLabel: { flex: 1, fontSize: 16, fontWeight: '500', color: colors.heading },
  rowLabelSelected: { fontWeight: '700', color: colors.brand },
})

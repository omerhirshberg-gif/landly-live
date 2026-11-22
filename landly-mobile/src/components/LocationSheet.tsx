import { useState } from 'react'
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import type { Coordinates } from '@shared/geo'
import { ISRAEL_REGIONS } from '@shared/israelCities'
import { DEFAULT_RADIUS_KM, RADII_KM, type LocationFilter, type RadiusKm } from '@shared/perks/locationFilter'
import AppText from './AppText'
import { areaName, AreaPickerSheet } from './LocationFilterBar'
import { useNearMe } from '../lib/useNearMe'
import SheetSlot, { SCRIM_COLOR, useSheetBounds } from './SheetSlot'
import LineIcon from './LineIcon'
import { useLang } from '../i18n/LangProvider'
import { tick } from '../lib/haptics'
import { webOnly } from '../lib/webStyles'
import { colors, radius } from '../theme'

type Area = Extract<LocationFilter, { kind: 'area' }>
interface Draft { coords: Coordinates | null; radiusKm: RadiusKm; area: Area | null }

const draftOf = (filter: LocationFilter | null): Draft =>
  filter?.kind === 'gps' ? { coords: filter.coords, radiusKm: filter.radiusKm, area: null } : { coords: null, radiusKm: DEFAULT_RADIUS_KM, area: filter }

// The location button's sheet (Home, Perks and every category): Near me with its 5 / 15 / 25 km radius, or a region or
// city picked by hand, kept as a draft until the sticky footer's Apply commits it (Reset clears the draft). Web:
// components/discover/LocationSheet.tsx. Each opening mounts it afresh, so the draft starts from what is applied.
export default function LocationSheet({ visible, filter, onApply, onClose }: {
  visible: boolean
  filter: LocationFilter | null
  onApply: (next: LocationFilter | null) => void
  onClose: () => void
}) {
  const { t, lang, isRtl } = useLang()
  const insets = useSafeAreaInsets()
  const bounds = useSheetBounds()
  const [draft, setDraft] = useState<Draft>(() => draftOf(filter))
  const [error, setError] = useState<string | null>(null)
  const [cities, setCities] = useState(false)
  const nearMe = useNearMe({
    active: !!draft.coords,
    onLocate: (coords) => setDraft((d) => ({ ...d, coords, area: null })),
    onClear: () => setDraft((d) => ({ ...d, coords: null })),
    onError: setError,
  })
  const pickArea = (area: Area) => setDraft((d) => ({ ...d, coords: null, area }))
  const apply = () => {
    onApply(draft.area ?? (draft.coords ? { kind: 'gps', coords: draft.coords, radiusKm: draft.radiusKm } : null))
    onClose()
  }
  const requesting = nearMe.state === 'requesting'
  const row = (key: string, label: string, selected: boolean, onPress: () => void, icon: 'locate' | 'pin', busy = false) => (
    <Pressable
      key={key}
      accessibilityRole="radio"
      accessibilityState={{ selected, checked: selected, busy }}
      android_ripple={{ color: 'rgba(0, 56, 184, 0.12)' }}
      onPress={() => { tick(); onPress() }}
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
    >
      {busy ? <ActivityIndicator size="small" color={colors.brand} /> : <LineIcon name={icon} size={18} color={selected ? colors.brand : colors.textMuted} strokeWidth={1.75} />}
      <AppText style={[styles.rowLabel, selected && styles.rowLabelSelected]}>{label}</AppText>
      {selected && <LineIcon name="check" size={20} color={colors.brand} strokeWidth={2.4} />}
    </Pressable>
  )
  const km = (n: number) => `${n} ${lang === 'he' ? 'ק״מ' : lang === 'ru' ? 'км' : 'km'}`
  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent navigationBarTranslucent onRequestClose={onClose}>
      <Pressable style={styles.scrim} onPress={onClose} accessibilityRole="button" accessibilityLabel={t('avatar_cancel')} />
      <SheetSlot>
        <View style={[styles.sheet, bounds, { paddingBottom: insets.bottom + 8, direction: isRtl ? 'rtl' : 'ltr' }]} accessibilityViewIsModal>
          <View style={styles.handle} />
          <ScrollView showsVerticalScrollIndicator={false} showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            <AppText accessibilityRole="header" style={styles.title}>{t('loc_sheet_title')}</AppText>
            <AppText accessibilityRole="header" style={styles.sectionTitle}>{t('loc_near_me_title')}</AppText>
            {row('near', t('geo_near_me_current'), !!draft.coords, () => { void nearMe.locate() }, 'locate', requesting)}
            {!!draft.coords && (
              <View style={styles.pills} accessibilityRole="toolbar">
                {RADII_KM.map((r) => (
                  <Pressable key={r} accessibilityRole="button" accessibilityState={{ selected: draft.radiusKm === r }} accessibilityLabel={`${t('loc_radius_label')} ${r}`} onPress={() => { tick(); setDraft((d) => ({ ...d, radiusKm: r })) }} style={[styles.pill, draft.radiusKm === r && styles.pillOn]}>
                    <AppText ltr style={[styles.pillText, draft.radiusKm === r && styles.pillTextOn]}>{km(r)}</AppText>
                  </Pressable>
                ))}
              </View>
            )}
            {!!error && !draft.coords && <AppText accessibilityLiveRegion="polite" style={styles.error}>{error}</AppText>}
            <AppText accessibilityRole="header" style={styles.sectionTitle}>{t('loc_choose_region_city')}</AppText>
            {ISRAEL_REGIONS.map((r) => row(r.id, r.names[lang], draft.area?.region === r.id && !draft.area.city, () => pickArea({ kind: 'area', region: r.id, city: null }), 'pin'))}
            {row('city', draft.area?.city ? areaName(draft.area, lang) : t('loc_other_city'), !!draft.area?.city, () => setCities(true), 'pin')}
          </ScrollView>
          <View style={styles.footer}>
            <Pressable accessibilityRole="button" onPress={() => { setDraft({ coords: null, radiusKm: DEFAULT_RADIUS_KM, area: null }); setError(null) }} hitSlop={8} style={styles.reset}>
              <AppText style={styles.resetText}>{t('loc_reset')}</AppText>
            </Pressable>
            <Pressable accessibilityRole="button" onPress={apply} style={({ pressed }) => [styles.apply, pressed && styles.applyPressed]}>
              <AppText style={styles.applyText}>{t('loc_apply')}</AppText>
            </Pressable>
          </View>
          <AreaPickerSheet visible={cities} onClose={() => setCities(false)} onPick={(a) => { setCities(false); pickArea(a) }} />
        </View>
      </SheetSlot>
    </Modal>
  )
}

const styles = StyleSheet.create({
  scrim: { flex: 1, backgroundColor: SCRIM_COLOR },
  sheet: { backgroundColor: colors.surfaceContainer, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingTop: 8, maxHeight: '86%', ...webOnly({ width: '100%', maxWidth: 560, alignSelf: 'center' }) },
  handle: { alignSelf: 'center', width: 32, height: 4, borderRadius: 2, backgroundColor: colors.textFaint, marginBottom: 8 },
  title: { fontSize: 20, lineHeight: 26, fontWeight: '800', color: colors.heading, paddingHorizontal: 24, paddingTop: 4, paddingBottom: 4 },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: colors.textMuted, paddingHorizontal: 24, paddingTop: 14, paddingBottom: 4 },
  row: { minHeight: 52, paddingHorizontal: 24, flexDirection: 'row', alignItems: 'center', gap: 12, ...webOnly({ cursor: 'pointer' }) },
  rowPressed: { backgroundColor: 'rgba(0, 56, 184, 0.08)' },
  rowLabel: { flex: 1, fontSize: 16, fontWeight: '500', color: colors.heading },
  rowLabelSelected: { fontWeight: '700', color: colors.brand },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 24, paddingTop: 2, paddingBottom: 6 },
  pill: { minHeight: 36, paddingHorizontal: 16, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border, backgroundColor: colors.white, ...webOnly({ cursor: 'pointer' }) },
  pillOn: { backgroundColor: colors.brand, borderColor: colors.brand },
  pillText: { fontSize: 14, fontWeight: '600', color: colors.textStrong },
  pillTextOn: { color: colors.white },
  error: { fontSize: 13, lineHeight: 18, fontWeight: '600', color: colors.danger, paddingHorizontal: 24, paddingTop: 2 },
  footer: { flexDirection: 'row', alignItems: 'center', gap: 16, paddingHorizontal: 24, paddingTop: 12, paddingBottom: 4, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, backgroundColor: colors.surfaceContainer },
  reset: { minHeight: 48, justifyContent: 'center', ...webOnly({ cursor: 'pointer' }) },
  resetText: { fontSize: 15, fontWeight: '600', color: colors.body, textDecorationLine: 'underline' },
  apply: { flex: 1, minHeight: 48, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.heading, ...webOnly({ cursor: 'pointer' }) },
  applyPressed: { opacity: 0.85 },
  applyText: { fontSize: 16, fontWeight: '700', color: colors.white },
})

import { useMemo, useState } from 'react'
import { FlatList, Modal, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { citiesOfRegion, cityLabel, ISRAEL_REGIONS, type RegionId } from '@shared/israelCities'
import { RADII_KM, type LocationFilter, type RadiusKm } from '@shared/perks/locationFilter'
import AppText from './AppText'
import LineIcon from './LineIcon'
import SheetSlot, { SCRIM_COLOR, useSheetBounds } from './SheetSlot'
import { useLang } from '../i18n/LangProvider'
import { webOnly } from '../lib/webStyles'
import { colors } from '../theme'

/** The area's name for a chip: the picked city, else the region. */
export function areaName(filter: Extract<LocationFilter, { kind: 'area' }>, lang: Parameters<typeof cityLabel>[1]): string {
  if (filter.city) return cityLabel(filter.city, lang)
  return ISRAEL_REGIONS.find((r) => r.id === filter.region)?.names[lang] ?? ''
}

// Under the Perks search row once a location is in play: "Near me · 5 km" with the 5 / 15 / 25 km radius pills, or the picked
// area as a chip, and a clear action (choosing the area lives in the Filter sheet, FilterSheet.tsx). Web: components/discover/LocationFilterBar.tsx.
export default function LocationFilterBar({ filter, onRadius, onClear }: {
  filter: LocationFilter | null
  onRadius: (km: RadiusKm) => void
  onClear: () => void
}) {
  const { t, lang } = useLang()
  if (!filter) return null
  return (
    <View style={styles.wrap}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} showsVerticalScrollIndicator={false} contentContainerStyle={styles.row} accessibilityRole="toolbar">
        {filter?.kind === 'gps' &&
          RADII_KM.map((km) => (
            <Pressable key={km} accessibilityRole="button" accessibilityState={{ selected: filter.radiusKm === km }} accessibilityLabel={`${t('loc_radius_label')} ${km}`} onPress={() => onRadius(km)} style={[styles.pill, filter.radiusKm === km && styles.pillOn]}>
              <AppText ltr style={[styles.pillText, filter.radiusKm === km && styles.pillTextOn]}>{`${km} ${lang === 'he' ? 'ק״מ' : lang === 'ru' ? 'км' : 'km'}`}</AppText>
            </Pressable>
          ))}
        {filter?.kind === 'area' && (
          <View style={[styles.pill, styles.pillOn]}>
            <AppText style={[styles.pillText, styles.pillTextOn]}>{t('loc_in_area').replace('{name}', `⁨${areaName(filter, lang)}⁩`)}</AppText>
          </View>
        )}
        {filter && (
          <Pressable accessibilityRole="button" accessibilityLabel={t('loc_clear')} onPress={onClear} style={styles.pill}>
            <LineIcon name="close" size={14} color={colors.textMuted} strokeWidth={2} />
            <AppText style={styles.pillText}>{t('loc_clear')}</AppText>
          </Pressable>
        )}
      </ScrollView>
    </View>
  )
}

export function AreaPickerSheet({ visible, onClose, onPick }: { visible: boolean; onClose: () => void; onPick: (a: Extract<LocationFilter, { kind: 'area' }>) => void }) {
  const { t, lang, isRtl } = useLang()
  const insets = useSafeAreaInsets()
  const bounds = useSheetBounds()
  const [region, setRegion] = useState<RegionId | null>(null)
  const [query, setQuery] = useState('')
  const q = query.trim().toLowerCase()
  const cities = useMemo(() => citiesOfRegion(q ? null : region, lang).filter((c) => !q || c.label.toLowerCase().includes(q) || c.he.includes(query.trim())), [region, lang, q, query])
  const regionName = ISRAEL_REGIONS.find((r) => r.id === region)?.names[lang] ?? ''
  const showRegions = !region && !q
  const close = () => { setRegion(null); setQuery(''); onClose() }
  type Row = { key: string; label: string; onPress: () => void; chevron?: boolean; strong?: boolean }
  const rows: Row[] = showRegions
    ? ISRAEL_REGIONS.map((r) => ({ key: r.id, label: r.names[lang], onPress: () => setRegion(r.id), chevron: true }))
    : [
        ...(region && !q ? [{ key: 'all', label: t('loc_all_in_region').replace('{name}', regionName), onPress: () => { close(); onPick({ kind: 'area', region, city: null }) }, strong: true }] : []),
        ...cities.map((c) => ({ key: c.he, label: c.label, onPress: () => { close(); onPick({ kind: 'area', region: null, city: c.he }) } })),
      ]
  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent navigationBarTranslucent onRequestClose={close}>
      <Pressable style={styles.scrim} onPress={close} accessibilityRole="button" accessibilityLabel={t('avatar_cancel')} />
      <SheetSlot>
        <View style={[styles.sheet, bounds, { paddingBottom: insets.bottom + 8, direction: isRtl ? 'rtl' : 'ltr' }]} accessibilityViewIsModal>
          <View style={styles.handle} />
          <View style={styles.sheetHead}>
            {region && !q ? (
              <Pressable accessibilityRole="button" accessibilityLabel={t('loc_back')} onPress={() => setRegion(null)} style={styles.back} hitSlop={8}>
                <LineIcon name="chevronStart" flip={isRtl} size={18} color={colors.textStrong} strokeWidth={2} />
              </Pressable>
            ) : null}
            <AppText accessibilityRole="header" style={styles.sheetTitle}>{region && !q ? regionName : t('loc_region_title')}</AppText>
          </View>
          <View style={styles.search}>
            <LineIcon name="search" size={16} color={colors.textFaint} strokeWidth={2} />
            <TextInput value={query} onChangeText={setQuery} placeholder={t('loc_city_search')} placeholderTextColor={colors.textFaint} style={[styles.input, { textAlign: isRtl ? 'right' : 'left' }]} accessibilityLabel={t('loc_city_search')} />
          </View>
          <FlatList
            showsVerticalScrollIndicator={false}
            showsHorizontalScrollIndicator={false}
            data={rows}
            keyExtractor={(r) => r.key}
            style={styles.list}
            keyboardShouldPersistTaps="handled"
            ListEmptyComponent={<AppText style={styles.empty}>{t('loc_no_cities')}</AppText>}
            renderItem={({ item }) => (
              <Pressable accessibilityRole="button" onPress={item.onPress} style={({ pressed }) => [styles.item, pressed && styles.itemPressed]}>
                <AppText style={[styles.itemText, item.strong && styles.itemStrong]}>{item.label}</AppText>
                {item.chevron && <LineIcon name="chevronEnd" flip={isRtl} size={16} color={colors.textFaint} strokeWidth={2} />}
              </Pressable>
            )}
          />
        </View>
      </SheetSlot>
    </Modal>
  )
}

const styles = StyleSheet.create({
  wrap: { marginTop: 2 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 2 },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 36, paddingHorizontal: 14, borderRadius: 18, borderWidth: 1, borderColor: '#E2E8F0', backgroundColor: '#FFFFFF', ...webOnly({ cursor: 'pointer' }) },
  pillOn: { backgroundColor: colors.brand, borderColor: colors.brand },
  pillText: { fontSize: 13, fontWeight: '600', color: colors.textStrong },
  pillTextOn: { color: '#FFFFFF' },
  scrim: { flex: 1, backgroundColor: SCRIM_COLOR },
  sheet: { backgroundColor: colors.surfaceContainer, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingTop: 8, maxHeight: '82%', ...webOnly({ width: '100%', maxWidth: 560, alignSelf: 'center' }) },
  handle: { alignSelf: 'center', width: 32, height: 4, borderRadius: 2, backgroundColor: colors.textFaint, marginBottom: 8 },
  sheetHead: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 20, paddingVertical: 8 },
  back: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  sheetTitle: { fontSize: 17, lineHeight: 23, fontWeight: '700', color: colors.heading },
  search: { flexDirection: 'row', alignItems: 'center', gap: 8, height: 44, marginHorizontal: 16, marginBottom: 8, paddingHorizontal: 14, borderRadius: 14, borderCurve: 'continuous', backgroundColor: '#F1F5F9' },
  input: { flex: 1, fontSize: 15, color: colors.textStrong, paddingVertical: 0, ...webOnly({ outlineStyle: 'none' }) },
  list: { flexGrow: 0 },
  item: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 52, paddingHorizontal: 24, ...webOnly({ cursor: 'pointer' }) },
  itemPressed: { backgroundColor: 'rgba(0, 56, 184, 0.08)' },
  itemText: { fontSize: 16, color: colors.heading },
  itemStrong: { fontWeight: '700', color: colors.brand },
  empty: { fontSize: 14, color: colors.textMuted, textAlign: 'center', padding: 20 },
})

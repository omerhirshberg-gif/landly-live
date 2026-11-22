import { useMemo, useState } from 'react'
import { FlatList, Image, Modal, Pressable, StyleSheet, TextInput, View, type ImageSourcePropType } from 'react-native'
import { useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { parseBusinessTranslations, localizedBusinessName } from '@shared/business/businessText'
import type { BrandIndexEntry } from '@shared/offers/branches'
import { sortBrandsByReach } from '@shared/offers/resolveChainBrand'
import AppText from './AppText'
import LineIcon from './LineIcon'
import SheetSlot, { SCRIM_COLOR, useSheetBounds } from './SheetSlot'
import { useLang } from '../i18n/LangProvider'
import { secureImageUrl } from '../lib/imageSource'
import { bundledBrandImage } from '../lib/raayonitBrandImages'
import { webOnly } from '../lib/webStyles'
import { colors } from '../theme'

// eslint-disable-next-line @typescript-eslint/no-require-imports
const MARK = require('../../assets/images/raayonit-logo.png') as ImageSourcePropType

// The brands a multi-chain pass works at, as a row of logo tiles: each shows its logo on a white stage, its name and how many
// branches honour the voucher, and opens that brand's own offer. A search narrows the row and "View all" lists every brand in
// a sheet. Each tile opens that chain's own page. Web: components/offers/BrandStrip.tsx.
export default function BrandStrip({ entries }: { entries: BrandIndexEntry[] }) {
  const { t, lang, isRtl } = useLang()
  const [query, setQuery] = useState('')
  const [all, setAll] = useState(false)
  const named = useMemo(() => sortBrandsByReach(entries).map((e) => ({ ...e, label: localizedBusinessName({ businessName: e.name, businessTranslations: parseBusinessTranslations(e.nameTranslations) }, lang).text })), [entries, lang])
  const q = query.trim().toLowerCase()
  const shown = q ? named.filter((e) => e.label.toLowerCase().includes(q) || e.name.includes(query.trim())) : named
  const count = String(named.length)
  return (
    <View style={styles.wrap}>
      <View style={styles.headRow}>
        <Pressable accessibilityRole="button" onPress={() => setAll(true)} style={({ pressed }) => [styles.headLink, pressed && styles.pressed]}>
          <AppText style={styles.headLinkText}>{t('brands_show_all').replace('{count}', `\u2066${count}\u2069`)}</AppText>
        </Pressable>
      </View>
      <View style={styles.search}>
        <LineIcon name="search" size={16} color={colors.textFaint} strokeWidth={2} />
        <TextInput value={query} onChangeText={setQuery} placeholder={t('brands_search')} placeholderTextColor={colors.textFaint} style={[styles.input, { textAlign: isRtl ? 'right' : 'left' }]} accessibilityLabel={t('brands_search')} returnKeyType="search" />
      </View>
      {shown.length === 0 ? (
        <AppText style={styles.empty}>{t('brands_no_results')}</AppText>
      ) : (
        <FlatList
          horizontal
          data={shown}
          keyExtractor={(b) => b.offerId}
          renderItem={({ item }) => <Tile entry={item} label={item.label} />}
          showsHorizontalScrollIndicator={false}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.rail}
          initialNumToRender={6}
          maxToRenderPerBatch={8}
          windowSize={5}
        />
      )}
      <Pressable accessibilityRole="button" onPress={() => setAll(true)} style={({ pressed }) => [styles.viewAll, pressed && styles.pressed]}>
        <AppText style={styles.viewAllText}>{t('brands_show_all_cta').replace('{count}', `\u2066${count}\u2069`)}</AppText>
      </Pressable>
      <AllBrands visible={all} onClose={() => setAll(false)} entries={named} />
    </View>
  )
}

// Every brand image is shown whole, with an even margin inside its rounded box, so nothing touches or crosses the border.
// A photo, or any image in the sheet, sits in front of a soft blurred copy of itself (as the offer cards draw it);
// a logo in the row sits on the white stage.
function Logo({ entry, backdrop = false }: { entry: BrandIndexEntry; backdrop?: boolean }) {
  const [failed, setFailed] = useState(false)
  const own = !failed && !!entry.logoUrl
  const source = own ? bundledBrandImage(entry.logoUrl) ?? { uri: secureImageUrl(entry.logoUrl) } : MARK
  const blurred = own && (backdrop || !!entry.photo)
  return (
    <View style={blurred ? styles.backdrop : styles.fill}>
      {blurred && (
        <>
          <Image source={source} style={StyleSheet.absoluteFill} resizeMode="cover" blurRadius={24} accessibilityIgnoresInvertColors />
          <View style={[StyleSheet.absoluteFill, styles.tint]} />
        </>
      )}
      <View style={styles.inset}>
        <Image source={source} style={styles.image} resizeMode="contain" onError={() => setFailed(true)} accessibilityIgnoresInvertColors />
      </View>
    </View>
  )
}

const countLabel = (t: (k: never) => string, n: number) => (n === 1 ? t('brands_one_branch' as never) : t('brands_branch_count' as never).replace('{count}', String(n)))

function Tile({ entry, label }: { entry: BrandIndexEntry; label: string }) {
  const { t } = useLang()
  const router = useRouter()
  return (
    <Pressable accessibilityRole="link" accessibilityLabel={label} onPress={() => router.push({ pathname: '/offer/[offerId]', params: { offerId: entry.offerId } })} style={({ pressed }) => [styles.tile, pressed && styles.pressed]}>
      <View style={styles.stage}>
        <Logo entry={entry} />
      </View>
      <AppText autoDir numberOfLines={1} style={styles.name}>{label}</AppText>
      {entry.branchCount > 0 && <AppText style={styles.count}>{countLabel(t as never, entry.branchCount)}</AppText>}
    </Pressable>
  )
}

function AllBrands({ visible, onClose, entries }: { visible: boolean; onClose: () => void; entries: (BrandIndexEntry & { label: string })[] }) {
  const { t, isRtl } = useLang()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const bounds = useSheetBounds()
  const [query, setQuery] = useState('')
  const q = query.trim().toLowerCase()
  const rows = q ? entries.filter((e) => e.label.toLowerCase().includes(q) || e.name.includes(query.trim())) : entries
  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent navigationBarTranslucent onRequestClose={onClose}>
      <Pressable style={styles.scrim} onPress={onClose} accessibilityRole="button" accessibilityLabel={t('avatar_cancel')} />
      <SheetSlot>
        <View style={[styles.sheet, bounds, { paddingBottom: insets.bottom + 8, direction: isRtl ? 'rtl' : 'ltr' }]} accessibilityViewIsModal>
          <View style={styles.handle} />
          <View style={[styles.search, styles.sheetSearch]}>
            <LineIcon name="search" size={16} color={colors.textFaint} strokeWidth={2} />
            <TextInput value={query} onChangeText={setQuery} placeholder={t('brands_search')} placeholderTextColor={colors.textFaint} style={[styles.input, { textAlign: isRtl ? 'right' : 'left' }]} accessibilityLabel={t('brands_search')} />
          </View>
          <FlatList
            showsVerticalScrollIndicator={false}
            showsHorizontalScrollIndicator={false}
            data={rows}
            numColumns={2}
            key="all-brands-2"
            keyExtractor={(e) => e.offerId}
            style={styles.list}
            columnWrapperStyle={styles.gridRow}
            contentContainerStyle={styles.grid}
            keyboardShouldPersistTaps="handled"
            ListEmptyComponent={<AppText style={styles.empty}>{t('brands_no_results')}</AppText>}
            renderItem={({ item }) => (
              <Pressable accessibilityRole="link" accessibilityLabel={item.label} onPress={() => { onClose(); router.push({ pathname: '/offer/[offerId]', params: { offerId: item.offerId } }) }} style={({ pressed }) => [styles.gridCell, pressed && styles.pressed]}>
                <View style={styles.gridStage}><Logo entry={item} backdrop /></View>
                <AppText autoDir numberOfLines={1} style={styles.name}>{item.label}</AppText>
                {item.branchCount > 0 && <AppText style={styles.count}>{countLabel(t as never, item.branchCount)}</AppText>}
              </Pressable>
            )}
          />
        </View>
      </SheetSlot>
    </Modal>
  )
}

const styles = StyleSheet.create({
  wrap: { gap: 12 },
  search: { flexDirection: 'row', alignItems: 'center', gap: 8, height: 44, paddingHorizontal: 14, borderRadius: 14, borderCurve: 'continuous', backgroundColor: '#F1F5F9' },
  sheetSearch: { marginHorizontal: 16, marginBottom: 8 },
  input: { flex: 1, fontSize: 15, color: colors.textStrong, paddingVertical: 0, ...webOnly({ outlineStyle: 'none' }) },
  rail: { flexDirection: 'row', gap: 10, paddingVertical: 2 },
  tile: { width: 136, gap: 4, ...webOnly({ cursor: 'pointer' }) },
  pressed: { opacity: 0.7 },
  stage: { width: 136, height: 92, borderRadius: 16, borderCurve: 'continuous', borderWidth: 1, borderColor: '#E2E8F0', backgroundColor: '#FFFFFF', overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  fill: { width: '100%', height: '100%' },
  image: { width: '100%', height: '100%' },
  name: { fontSize: 14, lineHeight: 19, fontWeight: '600', color: colors.textStrong },
  count: { fontSize: 12, lineHeight: 16, color: colors.textMuted },
  empty: { fontSize: 14, lineHeight: 20, color: colors.textMuted, paddingVertical: 12, textAlign: 'center' },
  headRow: { flexDirection: 'row', justifyContent: 'flex-end' },
  headLink: { minHeight: 44, justifyContent: 'center', ...webOnly({ cursor: 'pointer' }) },
  headLinkText: { fontSize: 14, fontWeight: '600', color: colors.brand },
  viewAll: { minHeight: 44, borderRadius: 12, borderCurve: 'continuous', borderWidth: 1, borderColor: 'rgba(0,56,184,0.25)', backgroundColor: '#F0F7FF', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16, ...webOnly({ cursor: 'pointer' }) },
  viewAllText: { fontSize: 14, fontWeight: '600', color: colors.brand, textAlign: 'center' },
  backdrop: { width: '100%', height: '100%', backgroundColor: '#F4F6F9', overflow: 'hidden' },
  tint: { backgroundColor: 'rgba(244,246,249,0.45)' },
  inset: { position: 'absolute', top: 12, left: 12, right: 12, bottom: 12 },
  grid: { paddingHorizontal: 16, paddingBottom: 12, gap: 12 },
  gridRow: { gap: 12 },
  gridCell: { flex: 1, maxWidth: '48.5%', gap: 4 },
  gridStage: { height: 92, borderRadius: 16, borderCurve: 'continuous', borderWidth: 1, borderColor: '#E2E8F0', backgroundColor: '#FFFFFF', overflow: 'hidden' },
  scrim: { flex: 1, backgroundColor: SCRIM_COLOR },
  sheet: { backgroundColor: colors.surfaceContainer, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingTop: 8, maxHeight: '82%', ...webOnly({ width: '100%', maxWidth: 560, alignSelf: 'center' }) },
  handle: { alignSelf: 'center', width: 32, height: 4, borderRadius: 2, backgroundColor: colors.textFaint, marginBottom: 12 },
  list: { flexGrow: 0 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 64, paddingHorizontal: 16, ...webOnly({ cursor: 'pointer' }) },
  rowStage: { width: 72, height: 48, borderRadius: 10, borderWidth: 1, borderColor: '#E2E8F0', backgroundColor: '#FFFFFF', overflow: 'hidden' },
  rowCopy: { flex: 1, gap: 2 },
})

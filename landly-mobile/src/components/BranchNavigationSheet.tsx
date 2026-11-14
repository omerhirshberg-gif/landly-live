import { Modal, Platform, Pressable, StyleSheet, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { buildBranchNavigationUrls, type BranchPoint } from '@shared/maps/navigation'
import AppText from './AppText'
import SheetSlot, { SCRIM_COLOR, useSheetBounds } from './SheetSlot'
import { useLang } from '../i18n/LangProvider'
import { openNavigation } from '../lib/openNavigation'
import { webOnly } from '../lib/webStyles'
import { colors } from '../theme'

export interface BranchTarget {
  /** The name as the reader sees it. */
  label: string
  /** The name as the admin wrote it, which is what the maps apps are searched for. */
  name: string
  brand?: string | null
  /** Exact position of a branch picked from Google Places; without it the branch is searched for by name. */
  point?: BranchPoint
}

// "Open in Waze / Google Maps" for one branch of a chain, as a bottom sheet (web: components/offers/BranchNavigationModal.tsx).
// Text only: the branch name on top, the two apps as rows, Cancel. A chosen app opens straight away and the sheet closes.
export default function BranchNavigationSheet({ branch, onClose }: { branch: BranchTarget | null; onClose: () => void }) {
  const { t, isRtl } = useLang()
  const insets = useSafeAreaInsets()
  const bounds = useSheetBounds()
  const urls = branch ? buildBranchNavigationUrls(branch.name, branch.brand, Platform.OS, branch.point) : null
  const rows = urls
    ? [
        { key: 'waze', label: 'Waze', a11y: t('offer_nav_waze'), app: urls.nativeWaze, web: urls.waze },
        { key: 'google', label: 'Google Maps', a11y: t('offer_nav_google'), app: urls.nativeGoogleMaps, web: urls.googleMaps },
      ]
    : []
  return (
    <Modal visible={!!branch} transparent animationType="fade" statusBarTranslucent navigationBarTranslucent onRequestClose={onClose}>
      <Pressable style={styles.scrim} onPress={onClose} accessibilityRole="button" accessibilityLabel={t('avatar_cancel')} />
      <SheetSlot>
        {/* A Modal is its own layout root, so the language's direction is set again here. */}
        <View style={[styles.sheet, bounds, { paddingBottom: insets.bottom + 8, direction: isRtl ? 'rtl' : 'ltr' }]} accessibilityViewIsModal>
          <View style={styles.handle} />
          <View style={styles.header}>
            <AppText autoDir accessibilityRole="header" style={styles.title} numberOfLines={2}>{branch?.label}</AppText>
            <AppText style={styles.caption}>{t('offer_nav_heading')}</AppText>
          </View>
          {rows.map((row) => (
            <Pressable
              key={row.key}
              accessibilityRole="link"
              accessibilityLabel={row.a11y}
              android_ripple={{ color: 'rgba(0, 56, 184, 0.12)' }}
              onPress={() => {
                onClose()
                void openNavigation(row.app, row.web)
              }}
              style={({ pressed }) => [styles.row, pressed && Platform.OS !== 'android' && styles.rowPressed]}
            >
              <AppText style={styles.rowLabel}>{row.label}</AppText>
            </Pressable>
          ))}
          <Pressable accessibilityRole="button" onPress={onClose} style={({ pressed }) => [styles.row, styles.cancel, pressed && Platform.OS !== 'android' && styles.rowPressed]}>
            <AppText style={styles.cancelLabel}>{t('avatar_cancel')}</AppText>
          </Pressable>
        </View>
      </SheetSlot>
    </Modal>
  )
}

const styles = StyleSheet.create({
  scrim: { flex: 1, backgroundColor: SCRIM_COLOR },
  sheet: {
    backgroundColor: colors.surfaceContainer,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingTop: 8,
    ...webOnly({ width: '100%', maxWidth: 560, alignSelf: 'center' }),
  },
  handle: { alignSelf: 'center', width: 32, height: 4, borderRadius: 2, backgroundColor: colors.textFaint, marginBottom: 8 },
  header: { paddingHorizontal: 24, paddingVertical: 8, gap: 2 },
  title: { fontSize: 17, lineHeight: 23, fontWeight: '700', color: colors.heading },
  caption: { fontSize: 13, lineHeight: 18, color: colors.textMuted },
  row: { minHeight: 56, paddingHorizontal: 24, justifyContent: 'center', ...webOnly({ cursor: 'pointer' }) },
  rowPressed: { backgroundColor: 'rgba(0, 56, 184, 0.08)' },
  rowLabel: { fontSize: 16, fontWeight: '600', color: colors.heading },
  cancel: { marginTop: 4 },
  cancelLabel: { fontSize: 16, fontWeight: '500', color: colors.textMuted },
})

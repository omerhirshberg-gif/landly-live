import { KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, View, useWindowDimensions } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import AppText from './AppText'
import CountryOfOriginList from './CountryOfOriginList'
import LineIcon from './LineIcon'
import SheetSlot, { SCRIM_COLOR, useSheetBounds } from './SheetSlot'
import { useLang } from '../i18n/LangProvider'
import { webOnly } from '../lib/webStyles'
import { colors } from '../theme'

// The country-of-origin list in a bottom sheet (web: the dialog in
// components/profile/OriginSelect.tsx). Edit profile shows one selector row;
// this opens from it with the search field and the list, and closes on a
// choice, the Close button, the scrim or the system back gesture. A Modal is
// its own layout root, so the language's direction is set again here.
export default function CountryOfOriginSheet({
  visible,
  value,
  onChange,
  onClose,
}: {
  visible: boolean
  value: string
  onChange: (code: string) => void
  onClose: () => void
}) {
  const { t, isRtl } = useLang()
  const insets = useSafeAreaInsets()
  const bounds = useSheetBounds()
  const { height } = useWindowDimensions()
  return (
    <Modal visible={visible} transparent animationType="slide" statusBarTranslucent navigationBarTranslucent onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.fill}>
        <Pressable style={styles.scrim} onPress={onClose} accessibilityRole="button" accessibilityLabel={t('onb_close')} />
        <SheetSlot>
          <View
            accessibilityViewIsModal
            style={[styles.sheet, bounds, { height: Math.min(height * 0.82, 720), paddingBottom: insets.bottom + 12, direction: isRtl ? 'rtl' : 'ltr' }]}
          >
            <View style={styles.handle} />
            <View style={styles.titleRow}>
              <AppText accessibilityRole="header" style={styles.title}>
                {t('profile_origin_label')}
              </AppText>
              <Pressable accessibilityRole="button" accessibilityLabel={t('onb_close')} onPress={onClose} hitSlop={8} style={styles.close}>
                <LineIcon name="close" size={20} color={colors.heading} />
              </Pressable>
            </View>
            <View style={styles.body}>
              <CountryOfOriginList
                value={value}
                fill
                onChange={(code) => {
                  onChange(code)
                  onClose()
                }}
              />
            </View>
          </View>
        </SheetSlot>
      </KeyboardAvoidingView>
    </Modal>
  )
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  scrim: { flex: 1, backgroundColor: SCRIM_COLOR },
  sheet: {
    backgroundColor: colors.surfaceContainer,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingTop: 8,
    ...webOnly({ width: '100%', maxWidth: 560, alignSelf: 'center' }),
  },
  handle: { alignSelf: 'center', width: 32, height: 4, borderRadius: 2, backgroundColor: colors.textFaint, marginBottom: 4 },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingHorizontal: 20, paddingVertical: 6 },
  title: { flex: 1, fontSize: 17, fontWeight: '700', color: colors.heading },
  close: { width: 44, height: 44, marginEnd: -10, borderRadius: 22, alignItems: 'center', justifyContent: 'center', ...webOnly({ cursor: 'pointer' }) },
  body: { flex: 1, paddingHorizontal: 16, paddingTop: 4 },
})

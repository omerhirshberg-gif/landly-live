import { useState } from 'react'
import { ActionSheetIOS, Modal, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { localizedName, type Area } from '@shared/geo'
import AppText from './AppText'
import LineIcon from './LineIcon'
import ScalePressable from './ScalePressable'
import { useLang } from '../i18n/LangProvider'
import { webOnly } from '../lib/webStyles'
import { colors, radius } from '../theme'

// "Choose area" under the Perks search row when the app can't get a location
// (permission denied, location services off, timeout): the cities that have
// perks, most perks first, and picking one sorts the list from its centre
// (web: the <select> in components/discover/NearMeButton.tsx). iOS opens the
// system action sheet; Android and the Expo web build a bottom sheet, the
// same split as SortSheet.
export default function AreaPicker({ areas, onPick }: { areas: Area[]; onPick: (area: Area) => void }) {
  const { t, lang } = useLang()
  const [open, setOpen] = useState(false)
  const names = areas.map((area) => localizedName(area.name, lang))

  const show = () => {
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        { title: t('geo_choose_area_title'), options: [...names, t('avatar_cancel')], cancelButtonIndex: names.length },
        (index) => {
          if (index < areas.length) onPick(areas[index]!)
        }
      )
    } else {
      setOpen(true)
    }
  }

  return (
    <>
      <ScalePressable pressedScale={0.96} accessibilityRole="button" accessibilityState={{ expanded: open }} onPress={show} style={styles.trigger}>
        <LineIcon name="pin" size={15} color={colors.brand} strokeWidth={2.2} />
        <AppText style={styles.triggerLabel}>{t('geo_choose_area')}</AppText>
        <LineIcon name="chevronDown" size={14} color={colors.brand} />
      </ScalePressable>
      {Platform.OS !== 'ios' && (
        <AreaSheet
          visible={open}
          names={names}
          onPick={(index) => {
            setOpen(false)
            onPick(areas[index]!)
          }}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  )
}

// A Modal is its own layout root, so the language's direction is set again here.
function AreaSheet({ visible, names, onPick, onClose }: { visible: boolean; names: string[]; onPick: (index: number) => void; onClose: () => void }) {
  const { t, isRtl } = useLang()
  const insets = useSafeAreaInsets()
  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent navigationBarTranslucent onRequestClose={onClose}>
      <Pressable style={styles.scrim} onPress={onClose} accessibilityRole="button" accessibilityLabel={t('avatar_cancel')} />
      <View style={[styles.sheet, { paddingBottom: insets.bottom + 8, direction: isRtl ? 'rtl' : 'ltr' }]} accessibilityViewIsModal>
        <View style={styles.handle} />
        <AppText accessibilityRole="header" style={styles.sheetTitle}>
          {t('geo_choose_area_title')}
        </AppText>
        <ScrollView style={styles.list} bounces={false}>
          {names.map((name, index) => (
            <Pressable
              key={`${name}-${index}`}
              accessibilityRole="button"
              android_ripple={{ color: 'rgba(0, 56, 184, 0.12)' }}
              onPress={() => onPick(index)}
              style={({ pressed }) => [styles.sheetRow, pressed && Platform.OS === 'web' && styles.sheetRowPressed]}
            >
              <AppText style={styles.sheetLabel}>{name}</AppText>
            </Pressable>
          ))}
        </ScrollView>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  trigger: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 44,
    paddingHorizontal: 14,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
    ...webOnly({ cursor: 'pointer', userSelect: 'none' }),
  },
  triggerLabel: { fontSize: 14, lineHeight: 20, fontWeight: '600', color: colors.brand },
  scrim: { flex: 1, backgroundColor: 'rgba(11, 27, 61, 0.32)' },
  sheet: {
    maxHeight: '70%',
    backgroundColor: colors.surfaceContainer,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingTop: 8,
    ...webOnly({ width: '100%', maxWidth: 560, alignSelf: 'center' }),
  },
  handle: { alignSelf: 'center', width: 32, height: 4, borderRadius: 2, backgroundColor: colors.textFaint, marginBottom: 8 },
  sheetTitle: { fontSize: 17, fontWeight: '700', color: colors.heading, paddingHorizontal: 24, paddingVertical: 8 },
  list: { flexGrow: 0 },
  sheetRow: { minHeight: 56, paddingHorizontal: 24, justifyContent: 'center', ...webOnly({ cursor: 'pointer' }) },
  sheetRowPressed: { backgroundColor: 'rgba(0, 56, 184, 0.08)' },
  sheetLabel: { fontSize: 16, fontWeight: '500', color: colors.heading },
})

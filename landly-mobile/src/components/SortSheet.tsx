import { useState } from 'react'
import { ActionSheetIOS, Modal, Platform, Pressable, StyleSheet, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { DEFAULT_PERK_SORT, PERK_SORTS, PERK_SORT_LABELS, type PerkSort } from '@shared/perks/perksFilter'
import AppText from './AppText'
import LineIcon from './LineIcon'
import ScalePressable from './ScalePressable'
import { useLang } from '../i18n/LangProvider'
import { webOnly } from '../lib/webStyles'
import { chipShadow, colors, radius } from '../theme'

// The Perks tab's compact "⇅ Sort" chip (web: components/perks/SortMenu.tsx).
// iOS opens the system action sheet; Android and the Expo web build get a
// bottom sheet with a check on the current order (same split as
// AvatarPicker). Styled like the category chips and pinned at the row's end,
// so it always reads a short "Sort" and never takes width from them; a
// non-default sort fills it solid brand blue, and its name is in the
// accessibility label and the sheet.
export default function SortSheet({ value, onChange }: { value: PerkSort; onChange: (next: PerkSort) => void }) {
  const { t } = useLang()
  const [open, setOpen] = useState(false)
  const active = value !== DEFAULT_PERK_SORT

  const show = () => {
    if (Platform.OS === 'ios') {
      const labels = PERK_SORTS.map((sort) => (sort === value ? `✓ ${t(PERK_SORT_LABELS[sort])}` : t(PERK_SORT_LABELS[sort])))
      ActionSheetIOS.showActionSheetWithOptions(
        { title: t('cats_sort_label'), options: [...labels, t('avatar_cancel')], cancelButtonIndex: labels.length },
        (index) => {
          if (index < PERK_SORTS.length) onChange(PERK_SORTS[index])
        }
      )
    } else {
      setOpen(true)
    }
  }

  return (
    <>
      <ScalePressable
        pressedScale={0.95}
        accessibilityRole="button"
        accessibilityLabel={`${t('cats_sort_label')}: ${t(PERK_SORT_LABELS[value])}`}
        accessibilityState={{ expanded: open }}
        hitSlop={{ top: 5, bottom: 5 }}
        onPress={show}
        style={[styles.trigger, active && styles.triggerActive]}
      >
        <LineIcon name="sort" size={16} color={active ? colors.white : colors.text} />
        <AppText style={[styles.triggerLabel, active && styles.triggerLabelActive]}>{t('cats_sort_trigger')}</AppText>
        <LineIcon name="chevronDown" size={14} color={active ? colors.white : colors.textMuted} />
      </ScalePressable>
      {Platform.OS !== 'ios' && (
        <OptionsSheet
          visible={open}
          value={value}
          onPick={(next) => {
            setOpen(false)
            onChange(next)
          }}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  )
}

// A Modal is its own layout root, so the language's direction is set again here.
function OptionsSheet({ visible, value, onPick, onClose }: { visible: boolean; value: PerkSort; onPick: (sort: PerkSort) => void; onClose: () => void }) {
  const { t, isRtl } = useLang()
  const insets = useSafeAreaInsets()
  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent navigationBarTranslucent onRequestClose={onClose}>
      <Pressable style={styles.scrim} onPress={onClose} accessibilityRole="button" accessibilityLabel={t('avatar_cancel')} />
      <View style={[styles.sheet, { paddingBottom: insets.bottom + 8, direction: isRtl ? 'rtl' : 'ltr' }]} accessibilityViewIsModal>
        <View style={styles.handle} />
        <AppText accessibilityRole="header" style={styles.sheetTitle}>
          {t('cats_sort_label')}
        </AppText>
        {PERK_SORTS.map((sort) => {
          const selected = sort === value
          return (
            <Pressable
              key={sort}
              accessibilityRole="radio"
              accessibilityState={{ selected, checked: selected }}
              android_ripple={{ color: 'rgba(0, 56, 184, 0.12)' }}
              onPress={() => onPick(sort)}
              style={({ pressed }) => [styles.sheetRow, pressed && Platform.OS === 'web' && styles.sheetRowPressed]}
            >
              <AppText style={[styles.sheetLabel, selected && styles.sheetLabelSelected]}>{t(PERK_SORT_LABELS[sort])}</AppText>
              {selected && <LineIcon name="check" size={20} color={colors.brand} strokeWidth={2.4} />}
            </Pressable>
          )
        })}
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  // Same 38pt chip as the category rail (+5pt hit slop each side).
  trigger: {
    flexShrink: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 38,
    paddingHorizontal: 12,
    borderRadius: radius.pill,
    backgroundColor: colors.borderLight,
    ...webOnly({ cursor: 'pointer', userSelect: 'none' }),
  },
  triggerActive: { backgroundColor: colors.brand, ...chipShadow },
  triggerLabel: { flexShrink: 0, fontSize: 14, lineHeight: 20, fontWeight: '600', color: colors.text },
  triggerLabelActive: { color: colors.white },
  scrim: { flex: 1, backgroundColor: 'rgba(11, 27, 61, 0.32)' },
  sheet: {
    backgroundColor: colors.surfaceContainer,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingTop: 8,
    ...webOnly({ width: '100%', maxWidth: 560, alignSelf: 'center' }),
  },
  handle: { alignSelf: 'center', width: 32, height: 4, borderRadius: 2, backgroundColor: colors.textFaint, marginBottom: 8 },
  sheetTitle: { fontSize: 17, fontWeight: '700', color: colors.heading, paddingHorizontal: 24, paddingVertical: 8 },
  sheetRow: {
    minHeight: 56,
    paddingHorizontal: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    ...webOnly({ cursor: 'pointer' }),
  },
  sheetRowPressed: { backgroundColor: 'rgba(0, 56, 184, 0.08)' },
  sheetLabel: { fontSize: 16, fontWeight: '500', color: colors.heading },
  sheetLabelSelected: { fontWeight: '700', color: colors.brand },
})

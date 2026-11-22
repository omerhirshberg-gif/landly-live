import { useState } from 'react'
import { Platform, Pressable, StyleSheet, useWindowDimensions } from 'react-native'
import type { LocationFilter } from '@shared/perks/locationFilter'
import LocationSheet from './LocationSheet'
import AppText from './AppText'
import LineIcon from './LineIcon'
import { useLang } from '../i18n/LangProvider'
import { impact } from '../lib/haptics'
import { webOnly } from '../lib/webStyles'
import { colors, radius } from '../theme'

// Dark ink like the rails' and categories' line icons, on white: no blue tint.
const tint = { bg: colors.white, bgPressed: colors.borderLight, border: colors.border, text: colors.textStrong }

// From this window width the label fits beside the search field (web: the
// `sm` breakpoint on components/discover/NearMeButton.tsx).
const LABEL_MIN_WIDTH = 640

// The location button at the end of the Perks, Home and category search rows. On phones it's an icon-only 44pt
// square (the label is its accessibilityLabel) so the search field keeps the width; on wide native windows (tablets,
// landscape) it shows the label too. Not on the Expo web build: there every screen sits in a 480px phone column
// ((tabs)/_layout.web.tsx). It opens the Location sheet (LocationSheet.tsx: Near me with its radius, or a region or city,
// then Apply) and is solid brand blue while a location filter is applied. Web: components/discover/NearMeButton.tsx.
export default function NearMeButton({ filter, onApply }: { filter: LocationFilter | null; onApply: (next: LocationFilter | null) => void }) {
  const { t } = useLang()
  const [open, setOpen] = useState(false)
  // Each opening mounts the sheet afresh, so its draft starts from what is applied.
  const [session, setSession] = useState(0)
  const active = !!filter

  const { width } = useWindowDimensions()
  const showLabel = Platform.OS !== 'web' && width >= LABEL_MIN_WIDTH
  return (
    <>
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t('geo_near_me_btn')}
      accessibilityState={{ selected: active, expanded: open }}
      hitSlop={4}
      onPress={() => { impact(); setSession((n) => n + 1); setOpen(true) }}
      style={({ pressed }) => [styles.button, showLabel && styles.buttonLabeled, active ? styles.active : pressed && styles.pressed]}
    >
      <LineIcon name="locate" size={showLabel ? 16 : 20} color={active ? colors.white : tint.text} strokeWidth={1.75} style={showLabel ? styles.iconSmall : styles.icon} />
      {showLabel && (
        <AppText style={[styles.label, active && styles.labelActive]} importantForAccessibility="no" accessibilityElementsHidden>
          {t('geo_near_me_btn')}
        </AppText>
      )}
    </Pressable>
    <LocationSheet key={session} visible={open} filter={filter} onApply={onApply} onClose={() => setOpen(false)} />
    </>
  )
}

const styles = StyleSheet.create({
  // A 44pt tinted square at the end of the search row.
  button: {
    width: 44,
    height: 44,
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: tint.border,
    backgroundColor: tint.bg,
    ...webOnly({ cursor: 'pointer', userSelect: 'none' }),
  },
  // Wide windows: icon + label, sized to the text (web: px-3.5).
  buttonLabeled: { width: 'auto', flexDirection: 'row', gap: 6, paddingHorizontal: 14 },
  pressed: { backgroundColor: tint.bgPressed },
  active: { backgroundColor: colors.brand, borderColor: colors.brand },
  icon: { width: 20, height: 20 },
  iconSmall: { width: 16, height: 16 },
  label: { flexShrink: 0, fontSize: 14, lineHeight: 20, fontWeight: '600', color: tint.text },
  labelActive: { color: colors.white },
})

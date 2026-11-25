import { useState } from 'react'
import { Pressable, StyleSheet } from 'react-native'
import AppText from './AppText'
import DirectionalIcon from './DirectionalIcon'
import { useLang } from '../i18n/LangProvider'
import { webOnly } from '../lib/webStyles'
import { colors, radius } from '../theme'

// Profile's Sign out: a calm destructive row, not a solid red block. A pale
// rose surface (dangerBg) with a hairline dangerBorder, the label and a line
// icon in the theme's red, and a slightly deeper rose while pressed. The icon
// points the reading direction (mirrored in Hebrew). Web twin:
// components/profile/SignOutRow.tsx.
export default function SignOutRow({ onPress }: { onPress: () => void | Promise<void> }) {
  const { t } = useLang()
  const [busy, setBusy] = useState(false)
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ busy }}
      disabled={busy}
      onPress={async () => {
        setBusy(true)
        try {
          await onPress()
        } finally {
          setBusy(false)
        }
      }}
      style={({ pressed }) => [styles.row, pressed && styles.pressed, busy && styles.busy]}
    >
      <DirectionalIcon name="signOut" size={20} color={colors.danger} strokeWidth={1.75} />
      <AppText style={styles.label}>{t('nav_logout')}</AppText>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    minHeight: 52,
    paddingHorizontal: 20,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.dangerBorder,
    backgroundColor: colors.dangerBg,
    ...webOnly({ cursor: 'pointer' }),
  },
  pressed: { backgroundColor: colors.dangerBorder },
  busy: { opacity: 0.6 },
  label: { fontSize: 16, fontWeight: '600', color: colors.danger },
})

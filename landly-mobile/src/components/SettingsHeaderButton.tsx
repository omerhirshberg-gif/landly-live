import { Pressable, StyleSheet } from 'react-native'
import { router } from 'expo-router'
import LineIcon from './LineIcon'
import { useLang } from '../i18n/LangProvider'
import { webOnly } from '../lib/webStyles'
import { colors, header } from '../theme'

// The Settings gear at the Profile tab's header trailing edge, in the top brand
// bar (TabHeader) opposite the GoLandly lockup. A 44pt target, 24pt glyph, the
// same box as WishlistHeaderButton so the icon sits at identical coordinates on
// every tab. Pushes the settings stack (language, Privacy & Security, help and
// the account-deletion request). Web twin: the Profile link in the navbar.
export default function SettingsHeaderButton() {
  const { t } = useLang()
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t('settings_gear_label')}
      onPress={() => router.push('/settings')}
      hitSlop={6}
      style={({ pressed }) => [styles.button, pressed && styles.pressed]}
    >
      <LineIcon name="gear" size={24} color={colors.heading} />
    </Pressable>
  )
}

const styles = StyleSheet.create({
  // The glyph sits 8pt in from the screen's 16pt gutter, like the heart.
  button: { width: header.action, height: header.action, borderRadius: header.action / 2, marginEnd: -8, alignItems: 'center', justifyContent: 'center', ...webOnly({ cursor: 'pointer' }) },
  pressed: { backgroundColor: colors.borderLight },
})

import { Pressable, StyleSheet } from 'react-native'
import { router } from 'expo-router'
import LineIcon from './LineIcon'
import { useLang } from '../i18n/LangProvider'
import { webOnly } from '../lib/webStyles'
import { colors, header } from '../theme'

// The saved perks' heart at a tab header's trailing edge (top right, top left
// in Hebrew): Home, Perks, Raayonit Card and My Pass. Profile has none; its
// header keeps only the Settings gear. A 44pt target, 24pt glyph. Web twin:
// WishlistPopover in the navbar.
export default function WishlistHeaderButton() {
  const { t } = useLang()
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t('wishlist_title')}
      onPress={() => router.push('/wishlist')}
      hitSlop={6}
      style={({ pressed }) => [styles.button, pressed && styles.pressed]}
    >
      <LineIcon name="heart" size={24} color={colors.heading} />
    </Pressable>
  )
}

const styles = StyleSheet.create({
  // The glyph sits 8pt in from the screen's 16pt gutter, like the Settings gear.
  button: { width: header.action, height: header.action, borderRadius: header.action / 2, marginEnd: -8, alignItems: 'center', justifyContent: 'center', ...webOnly({ cursor: 'pointer' }) },
  pressed: { backgroundColor: colors.borderLight },
})

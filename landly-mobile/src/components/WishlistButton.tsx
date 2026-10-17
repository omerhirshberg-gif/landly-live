import { Pressable, StyleSheet, View } from 'react-native'
import { router } from 'expo-router'
import { useWishlist } from '@shared/firebase/useWishlist'
import AppText from './AppText'
import LineIcon from './LineIcon'
import { useLang } from '../i18n/LangProvider'
import { webOnly } from '../lib/webStyles'
import { actionTint, colors, radius } from '../theme'

// The heart after Near Me at the end of the Perks search row: the same 44pt
// brand-tinted square, with a live count of saved perks on its top end
// corner. It pushes the wishlist (app/wishlist.tsx) as a page flip.
export default function WishlistButton() {
  const { t } = useLang()
  const { wishlistIds } = useWishlist()
  const count = wishlistIds.length

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={count > 0 ? `${t('wishlist_title')}, ${count}` : t('wishlist_title')}
      hitSlop={4}
      onPress={() => router.push('/wishlist')}
      style={({ pressed }) => [styles.button, pressed && styles.pressed]}
    >
      <LineIcon name="heart" size={20} color={actionTint.text} strokeWidth={2.2} />
      {count > 0 && (
        <View style={styles.badge} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <AppText ltr style={styles.badgeText}>
            {count > 99 ? '99+' : String(count)}
          </AppText>
        </View>
      )}
    </Pressable>
  )
}

const styles = StyleSheet.create({
  button: {
    width: 44,
    height: 44,
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: actionTint.border,
    backgroundColor: actionTint.bg,
    ...webOnly({ cursor: 'pointer', userSelect: 'none' }),
  },
  pressed: { backgroundColor: actionTint.bgPressed },
  // `end` follows the root direction, so in Hebrew the badge sits on the top left.
  badge: {
    position: 'absolute',
    top: -6,
    end: -6,
    minWidth: 20,
    height: 20,
    paddingHorizontal: 5,
    borderRadius: radius.pill,
    borderWidth: 2,
    borderColor: colors.background,
    backgroundColor: colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { fontSize: 11, lineHeight: 14, fontWeight: '700', color: colors.white, textAlign: 'center', fontVariant: ['tabular-nums'] },
})

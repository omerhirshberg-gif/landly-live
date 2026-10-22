import { Image, Linking, Platform, Pressable, StyleSheet, View } from 'react-native'
import { nativeNavigationUrls, navigationLinks, type NavigationDestination } from '@shared/maps/navigation'
import AppText from './AppText'
import { useLang } from '../i18n/LangProvider'
import { webOnly } from '../lib/webStyles'
import { colors } from '../theme'

// Waze and Google Maps, side by side under the address on the offer screen
// (web: components/offers/NavigationLinks.tsx). On a phone it opens the app
// straight into navigation through its own URL scheme; without the app (the
// scheme fails to open) the https link opens instead, which the store app or
// the browser picks up. The web build opens the https link in a new tab.
// Nothing when the business has no address.
async function open(appUrl: string | undefined, webUrl: string) {
  if (Platform.OS === 'web' || !appUrl) return Linking.openURL(webUrl).catch(() => {})
  try {
    await Linking.openURL(appUrl)
  } catch {
    await Linking.openURL(webUrl).catch(() => {})
  }
}

// The official app marks (assets/icons, the same files as the website's
// public/icons), drawn at 20pt. Waze's mark is a square tile, so it's rounded
// like an app icon; Google Maps' pin is transparent.
const WAZE_ICON = require('../../assets/icons/waze.webp')
const GOOGLE_MAPS_ICON = require('../../assets/icons/google-maps.webp')

export default function NavigationButtons({ destination }: { destination: NavigationDestination }) {
  const { t } = useLang()
  const links = navigationLinks(destination)
  if (!links) return null
  const apps = nativeNavigationUrls(destination.geo, Platform.OS)
  // Equal halves of one row; the row mirrors on its own in Hebrew.
  return (
    <View style={styles.row} accessibilityLabel={t('offer_nav_heading')}>
      <Pressable
        accessibilityRole="link"
        accessibilityLabel={t('offer_nav_waze')}
        onPress={() => open(apps?.waze, links.waze)}
        style={({ pressed }) => [styles.button, pressed && styles.pressed]}
      >
        <Image source={WAZE_ICON} style={[styles.icon, styles.iconTile]} resizeMode="contain" accessibilityIgnoresInvertColors />
        <AppText style={styles.label} numberOfLines={1}>Waze</AppText>
      </Pressable>
      <Pressable
        accessibilityRole="link"
        accessibilityLabel={t('offer_nav_google')}
        onPress={() => open(apps?.googleMaps, links.googleMaps)}
        style={({ pressed }) => [styles.button, pressed && styles.pressed]}
      >
        <Image source={GOOGLE_MAPS_ICON} style={styles.icon} resizeMode="contain" accessibilityIgnoresInvertColors />
        <AppText style={styles.label} numberOfLines={1}>Google Maps</AppText>
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 12, marginTop: 12 },
  // White, hairline-bordered, rounded-xl, with a shadow-sm lift.
  button: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 46,
    paddingHorizontal: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
    ...webOnly({ cursor: 'pointer' }),
  },
  pressed: { backgroundColor: colors.brandTint },
  icon: { width: 20, height: 20 },
  iconTile: { borderRadius: 5 },
  label: { flexShrink: 1, fontSize: 13.5, fontWeight: '600', color: colors.heading },
})

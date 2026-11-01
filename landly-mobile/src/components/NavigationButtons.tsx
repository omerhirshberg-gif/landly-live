import { Image, Linking, Platform, Pressable, StyleSheet, View } from 'react-native'
import { nativeNavigationUrls, navigationLinks, type NavigationDestination } from '@shared/maps/navigation'
import { useLang } from '../i18n/LangProvider'
import { webOnly } from '../lib/webStyles'
import { colors } from '../theme'

// Waze and Google Maps as a compact pair of 44pt icon links, beside the address on the offer screen
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

// The official app marks (assets/icons, 144px copies of the website's
// public/icons, so nothing is scaled up), each in its own container. Waze's mark
// is a cyan tile to its corners, so it fills the button with no white around it;
// Google Maps' pin is transparent and cropped to its own edges, so it stands in a
// white tile, as tall as its 32pt box.
const WAZE_ICON = require('../../assets/icons/waze.webp')
const GOOGLE_MAPS_ICON = require('../../assets/icons/google-maps.webp')
const WAZE_CYAN = '#33ccff'

export default function NavigationButtons({ destination }: { destination: NavigationDestination }) {
  const { t } = useLang()
  const links = navigationLinks(destination)
  if (!links) return null
  const apps = nativeNavigationUrls(destination.geo, Platform.OS)
  // The row mirrors on its own in Hebrew.
  return (
    <View style={styles.row} accessibilityLabel={t('offer_nav_heading')}>
      <Pressable
        accessibilityRole="link"
        accessibilityLabel={t('offer_nav_waze')}
        onPress={() => open(apps?.waze, links.waze)}
        style={({ pressed }) => [styles.button, styles.waze, pressed && styles.wazePressed]}
      >
        {/* Clipped in here: on the button itself that would drop its iOS shadow. */}
        <View style={styles.wazeClip}>
          <Image source={WAZE_ICON} style={styles.wazeIcon} resizeMode="cover" accessibilityIgnoresInvertColors />
        </View>
      </Pressable>
      <Pressable
        accessibilityRole="link"
        accessibilityLabel={t('offer_nav_google')}
        onPress={() => open(apps?.googleMaps, links.googleMaps)}
        style={({ pressed }) => [styles.button, styles.googleMaps, pressed && styles.pressed]}
      >
        <Image source={GOOGLE_MAPS_ICON} style={styles.icon} resizeMode="contain" accessibilityIgnoresInvertColors />
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 8, flexShrink: 0, marginStart: 'auto' },
  // rounded-xl: a 44pt target around the mark. Not clipped: on iOS that would drop the shadow.
  button: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 44,
    height: 44,
    borderRadius: 12,
    shadowColor: colors.textStrong,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
    ...webOnly({ cursor: 'pointer' }),
  },
  googleMaps: { borderWidth: 1, borderColor: 'rgba(226, 232, 240, 0.9)', backgroundColor: colors.white },
  pressed: { backgroundColor: colors.brandTint },
  icon: { width: 32, height: 32 },
  waze: { backgroundColor: WAZE_CYAN },
  wazePressed: { opacity: 0.85 },
  wazeClip: { width: '100%', height: '100%', borderRadius: 12, overflow: 'hidden' },
  wazeIcon: { width: '100%', height: '100%' },
})

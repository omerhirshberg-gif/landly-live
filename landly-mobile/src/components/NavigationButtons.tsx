import { Linking, Platform, Pressable, StyleSheet, View } from 'react-native'
import { nativeNavigationUrls, navigationLinks, type NavigationDestination } from '@shared/maps/navigation'
import AppText from './AppText'
import LineIcon from './LineIcon'
import { useLang } from '../i18n/LangProvider'
import { webOnly } from '../lib/webStyles'
import { colors, radius } from '../theme'

// "Navigate with Waze" / "Google Maps" under the address on the offer screen
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

export default function NavigationButtons({ destination }: { destination: NavigationDestination }) {
  const { t } = useLang()
  const links = navigationLinks(destination)
  if (!links) return null
  const apps = nativeNavigationUrls(destination.geo, Platform.OS)
  return (
    <View style={styles.row} accessibilityLabel={t('offer_nav_heading')}>
      <Pressable
        accessibilityRole="link"
        onPress={() => open(apps?.waze, links.waze)}
        style={({ pressed }) => [styles.chip, pressed && styles.pressed]}
      >
        <LineIcon name="navigation" size={15} color={colors.brand} strokeWidth={2.2} />
        <AppText style={styles.label}>{t('offer_nav_waze')}</AppText>
      </Pressable>
      <Pressable
        accessibilityRole="link"
        onPress={() => open(apps?.googleMaps, links.googleMaps)}
        style={({ pressed }) => [styles.chip, pressed && styles.pressed]}
      >
        <LineIcon name="map" size={15} color={colors.brand} strokeWidth={2.2} />
        <AppText style={styles.label}>{t('offer_nav_google')}</AppText>
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: 44,
    paddingHorizontal: 16,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
    ...webOnly({ cursor: 'pointer' }),
  },
  pressed: { backgroundColor: colors.brandTint },
  label: { fontSize: 14, fontWeight: '600', color: colors.heading },
})

import { Platform, StyleSheet, View } from 'react-native'
import { NativeTabs } from 'expo-router/unstable-native-tabs'
import { useRaayonitDisplay } from '@shared/flags/raayonitDisplayStore'
import { useLang } from '../../i18n/LangProvider'
import { colors } from '../../theme'
import { tick } from '../../lib/haptics'

// Five tabs on the platform's own tab bar (web uses _layout.web.tsx):
// - iOS: the system UITabBar, so iOS 26 draws it in Liquid Glass with Reduce
//   Transparency, Increase Contrast and Dynamic Type handled by the system;
//   nothing here touches its appearance there, which would replace the glass.
//   Before iOS 26 the bar sits on the screen's edge, and by default turns
//   transparent with no separator whenever the content isn't scrolled behind
//   it, so it blends into the page: there it keeps the chrome material and a
//   border-coloured hairline at all times. Tab screens run edge to edge
//   underneath; their scroll views use automatic content insets, so content
//   scrolls behind the bar and ends clear of it.
// - Android and web have their own layouts (_layout.android.tsx, _layout.web.tsx) on a shared JS tab bar.
// The order is physical and permanent: Home far left, then Perks, the Raayonit
// Card ("תו על"), My Pass, Profile far right, in every language. The Raayonit tab
// is there only while Raayonit's name may be shown (useRaayonitDisplay), so with
// it off the bar has four. The saved perks (Wishlist) open from the Profile
// tab's heart. Native layout direction stays LTR
// (supportsRTL is off in app.json); Hebrew only flips the JS root view, so
// the screens follow the language while the bar never mirrors.
const iosVersion = Platform.OS === 'ios' ? parseInt(String(Platform.Version), 10) : 0
const iosEdgeBar =
  Platform.OS === 'ios' && iosVersion < 26
    ? { disableTransparentOnScrollEdge: true, blurEffect: 'systemChromeMaterial' as const, shadowColor: colors.border }
    : {}

// A render error here shows the retry card; the rest of the app stays up.
export { default as ErrorBoundary } from '../../components/RouteErrorBoundary'

export default function TabsLayout() {
  const { t } = useLang()
  const raayonit = useRaayonitDisplay()

  return (
    <View style={styles.root}>
      <NativeTabs tintColor={colors.brand} screenListeners={{ tabPress: () => tick() }} {...iosEdgeBar}>
        <NativeTabs.Trigger name="index">
          <NativeTabs.Trigger.Icon sf={{ default: 'house', selected: 'house.fill' }} md="home" />
          <NativeTabs.Trigger.Label>{t('mobile_tab_home')}</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="perks">
          <NativeTabs.Trigger.Icon sf={{ default: 'gift', selected: 'gift.fill' }} md="redeem" />
          <NativeTabs.Trigger.Label>{t('mobile_tab_perks')}</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>
        {raayonit && (
          <NativeTabs.Trigger name="raayonit">
            <NativeTabs.Trigger.Icon sf={{ default: 'creditcard', selected: 'creditcard.fill' }} md="credit_card" />
            <NativeTabs.Trigger.Label>{t('nav_raayonit')}</NativeTabs.Trigger.Label>
          </NativeTabs.Trigger>
        )}
        <NativeTabs.Trigger name="wallet">
          <NativeTabs.Trigger.Icon sf={{ default: 'ticket', selected: 'ticket.fill' }} md="confirmation_number" />
          <NativeTabs.Trigger.Label>{t('mobile_tab_wallet')}</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="profile">
          <NativeTabs.Trigger.Icon sf={{ default: 'person.crop.circle', selected: 'person.crop.circle.fill' }} md="account_circle" />
          <NativeTabs.Trigger.Label>{t('nav_profile')}</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>
      </NativeTabs>
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1 },
})

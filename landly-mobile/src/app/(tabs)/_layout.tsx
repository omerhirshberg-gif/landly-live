import { Platform } from 'react-native'
import { NativeTabs } from 'expo-router/unstable-native-tabs'
import { useWishlist } from '@shared/firebase/useWishlist'
import { useLang } from '../../i18n/LangProvider'
import { colors } from '../../theme'

// Five tabs on the platform's own tab bar (web uses _layout.web.tsx):
// - iOS: the system UITabBar, so iOS 26 draws it in Liquid Glass (and older
//   iOS in its standard material) with Reduce Transparency, Increase
//   Contrast and Dynamic Type handled by the system. Nothing here sets a
//   background, blur or shadow, which would replace the glass. Tab screens
//   run edge to edge underneath; their scroll views use automatic content
//   insets, so content scrolls behind the bar and ends clear of it.
// - Android: the Material 3 navigation bar: solid surfaceContainer, the
//   brandLight indicator pill behind the active icon, native ripple, laid out
//   above the gesture or 3-button system bar.
// The system lays the five out in equal columns at its own bar height.
// The order is physical and permanent: Home far left, then Perks, Wishlist,
// My Pass, Profile far right, in every language. The Wishlist tab carries the
// live count of saved perks as its badge. Native layout direction stays LTR
// (supportsRTL is off in app.json); Hebrew only flips the JS root view, so
// the screens follow the language while the bar never mirrors.
const androidBar = Platform.OS === 'android'
  ? {
      backgroundColor: colors.surfaceContainer,
      indicatorColor: colors.brandLight,
      rippleColor: colors.border,
      iconColor: { default: colors.body, selected: colors.brand },
      labelStyle: { default: { color: colors.body }, selected: { color: colors.brand } },
      labelVisibilityMode: 'labeled' as const,
    }
  : {}

export default function TabsLayout() {
  const { t } = useLang()
  const { wishlistCount } = useWishlist()

  return (
    <NativeTabs tintColor={colors.brand} {...androidBar}>
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Icon sf={{ default: 'house', selected: 'house.fill' }} md="home" />
        <NativeTabs.Trigger.Label>{t('mobile_tab_home')}</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="perks">
        <NativeTabs.Trigger.Icon sf={{ default: 'gift', selected: 'gift.fill' }} md="redeem" />
        <NativeTabs.Trigger.Label>{t('mobile_tab_perks')}</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="wishlist">
        <NativeTabs.Trigger.Icon sf={{ default: 'heart', selected: 'heart.fill' }} md={{ default: 'favorite_border', selected: 'favorite' }} />
        <NativeTabs.Trigger.Label>{t('wishlist_title')}</NativeTabs.Trigger.Label>
        {/* Only with saved perks: an empty Badge still draws a dot (its value becomes ' '). */}
        {wishlistCount > 0 && <NativeTabs.Trigger.Badge>{String(wishlistCount)}</NativeTabs.Trigger.Badge>}
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="wallet">
        <NativeTabs.Trigger.Icon sf={{ default: 'ticket', selected: 'ticket.fill' }} md="confirmation_number" />
        <NativeTabs.Trigger.Label>{t('mobile_tab_wallet')}</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="profile">
        <NativeTabs.Trigger.Icon sf={{ default: 'person.crop.circle', selected: 'person.crop.circle.fill' }} md="account_circle" />
        <NativeTabs.Trigger.Label>{t('nav_profile')}</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  )
}

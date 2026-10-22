import { StyleSheet, View, type ColorValue } from 'react-native'
import { Tabs } from 'expo-router/js-tabs'
import { useWishlist } from '@shared/firebase/useWishlist'
import TabIcon, { type TabIconName } from '../../components/TabIcon'
import { useLang } from '../../i18n/LangProvider'
import { colors } from '../../theme'

// Web (Expo export) only; iOS and Android use the system tab bar in
// _layout.tsx. NativeTabs' web fallback is a dark pill fixed to the top of
// the viewport, over every screen title, so web keeps this plain white bar
// inside the app's centred phone-width column: a desktop browser never gets
// a viewport-wide mobile tab bar. Same five tabs in equal columns, same physical order: the
// root view sets direction: rtl for Hebrew, so the bar pins direction: ltr
// (Home stays far left); the screens themselves still follow the language.
export default function TabsLayout() {
  const { t } = useLang()
  const { wishlistCount } = useWishlist()

  return (
    <View style={styles.frame}>
      <View style={styles.column}>
        <Tabs
          screenOptions={{
            headerShown: false,
            tabBarActiveTintColor: colors.brand,
            tabBarInactiveTintColor: colors.textFaint,
            tabBarLabelStyle: styles.label,
            tabBarIconStyle: styles.icon,
            tabBarItemStyle: styles.item,
            tabBarBadgeStyle: styles.badge,
            tabBarStyle: styles.bar,
            sceneStyle: { backgroundColor: colors.background },
          }}
        >
          <Tabs.Screen name="index" options={{ title: t('mobile_tab_home'), tabBarIcon: (props) => <Glyph name="home" {...props} /> }} />
          <Tabs.Screen name="perks" options={{ title: t('mobile_tab_perks'), tabBarIcon: (props) => <Glyph name="perks" {...props} /> }} />
          <Tabs.Screen
            name="wishlist"
            options={{
              title: t('wishlist_title'),
              tabBarBadge: wishlistCount > 0 ? wishlistCount : undefined,
              tabBarIcon: (props) => <Glyph name="wishlist" {...props} />,
            }}
          />
          <Tabs.Screen name="wallet" options={{ title: t('mobile_tab_wallet'), tabBarIcon: (props) => <Glyph name="pass" {...props} /> }} />
          <Tabs.Screen name="profile" options={{ title: t('nav_profile'), tabBarIcon: (props) => <Glyph name="profile" {...props} /> }} />
        </Tabs>
      </View>
    </View>
  )
}

function Glyph({ name, color, size, focused }: { name: TabIconName; color: ColorValue; size: number; focused: boolean }) {
  return <TabIcon name={name} color={color} size={size} focused={focused} />
}

const styles = StyleSheet.create({
  frame: { flex: 1, backgroundColor: colors.background },
  column: {
    flex: 1,
    width: '100%',
    maxWidth: 480,
    alignSelf: 'center',
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: colors.border,
  },
  label: { fontSize: 10, fontWeight: '600', marginTop: 3 },
  icon: { marginBottom: 0 },
  item: { flex: 1, paddingTop: 4 },
  badge: { backgroundColor: colors.heart, color: colors.white, fontSize: 10, fontWeight: '700' },
  bar: { direction: 'ltr', backgroundColor: colors.white, borderTopWidth: 1, borderTopColor: colors.border },
})

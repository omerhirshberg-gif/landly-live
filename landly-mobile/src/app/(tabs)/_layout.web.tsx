import { StyleSheet, View, type ColorValue } from 'react-native'
import { Tabs } from 'expo-router/js-tabs'
import { useRaayonitDisplay } from '@shared/flags/raayonitDisplayStore'
import TabIcon, { type TabIconName } from '../../components/TabIcon'
import { useLang } from '../../i18n/LangProvider'
import { colors } from '../../theme'

// Web (Expo export) only; iOS and Android use the system tab bar in
// _layout.tsx. NativeTabs' web fallback is a dark pill fixed to the top of
// the viewport, over every screen title, so web keeps this plain white bar
// inside the app's centred phone-width column: a desktop browser never gets
// a viewport-wide mobile tab bar. Same tabs (Home, Perks, Raayonit Card, My Pass, Profile) in equal columns, same physical order: the
// root view sets direction: rtl for Hebrew, so the bar pins direction: ltr
// (Home stays far left); the screens themselves still follow the language.
// A render error here shows the retry card; the rest of the app stays up.
export { default as ErrorBoundary } from '../../components/RouteErrorBoundary'

export default function TabsLayout() {
  const { t } = useLang()
  const raayonit = useRaayonitDisplay()

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
            tabBarStyle: styles.bar,
            sceneStyle: { backgroundColor: colors.background },
          }}
        >
          <Tabs.Screen name="index" options={{ title: t('mobile_tab_home'), tabBarIcon: (props) => <Glyph name="home" {...props} /> }} />
          <Tabs.Screen name="perks" options={{ title: t('mobile_tab_perks'), tabBarIcon: (props) => <Glyph name="perks" {...props} /> }} />
          {/* Only while Raayonit's name may be shown; href null drops the tab (and its route) from the bar. */}
          <Tabs.Screen name="raayonit" options={{ title: t('nav_raayonit'), href: raayonit ? undefined : null, tabBarIcon: (props) => <Glyph name="raayonit" {...props} /> }} />
          <Tabs.Screen name="wallet" options={{ title: t('mobile_tab_wallet'), tabBarIcon: (props) => <Glyph name="pass" {...props} /> }} />
          <Tabs.Screen
            name="profile"
            options={{
              title: t('nav_profile'),
              tabBarIcon: (props) => <Glyph name="profile" {...props} />,
            }}
          />
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
    borderStartWidth: 1,
    borderEndWidth: 1,
    borderColor: colors.border,
  },
  label: { fontSize: 12, fontWeight: '600', marginTop: 2 },
  icon: { marginBottom: 0 },
  item: { flex: 1, paddingTop: 4 },
  bar: { direction: 'ltr', backgroundColor: colors.white, borderTopWidth: 1, borderTopColor: colors.border },
})

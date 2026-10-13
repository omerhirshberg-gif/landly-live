import { Tabs } from 'expo-router/js-tabs'
import TabIcon from '../../components/TabIcon'
import { useLang } from '../../i18n/LangProvider'
import { colors } from '../../theme'

export default function TabsLayout() {
  const { t } = useLang()
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.brand,
        tabBarInactiveTintColor: colors.textFaint,
        tabBarLabelStyle: { fontSize: 12, fontWeight: '700' },
        sceneStyle: { backgroundColor: colors.background },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ title: t('mobile_tab_perks'), tabBarIcon: ({ color, size }) => <TabIcon name="perks" color={color} size={size} /> }}
      />
      <Tabs.Screen
        name="wallet"
        options={{ title: t('mobile_tab_wallet'), tabBarIcon: ({ color, size }) => <TabIcon name="wallet" color={color} size={size} /> }}
      />
      <Tabs.Screen
        name="profile"
        options={{ title: t('dash_tab_profile'), tabBarIcon: ({ color, size }) => <TabIcon name="profile" color={color} size={size} /> }}
      />
    </Tabs>
  )
}

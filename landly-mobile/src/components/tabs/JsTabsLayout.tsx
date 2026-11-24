import { StyleSheet, Text, View, useWindowDimensions, type ColorValue } from 'react-native'
import { Tabs } from 'expo-router/js-tabs'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useRaayonitDisplay } from '@shared/flags/raayonitDisplayStore'
import TabIcon, { type TabIconName } from '../TabIcon'
import { useLang } from '../../i18n/LangProvider'
import { colors } from '../../theme'

// Shared JS tab bar for web (_layout.web.tsx) and Android (_layout.android.tsx); iOS keeps the system tab bar in
// _layout.tsx. Android uses it because the Material native bar cannot shrink a label to fit; this one can.
// NativeTabs' web fallback is a dark pill fixed to the top of
// the viewport, over every screen title, so web keeps this plain white bar
// inside the app's centred phone-width column: a desktop browser never gets
// a viewport-wide mobile tab bar. Same tabs (Home, Perks, Raayonit Card, My Pass, Profile) in equal columns, same physical order: the
// root view sets direction: rtl for Hebrew, so the bar pins direction: ltr
// (Home stays far left); the screens themselves still follow the language.
export default function JsTabsLayout({ onTabPress }: { onTabPress?: () => void }) {
  const { t } = useLang()
  const raayonit = useRaayonitDisplay()
  // An explicit bar height replaces the navigator's own inset handling, so the bottom inset (Android's 3-button or
  // gesture bar, the iOS home indicator, the mobile-web safe area) is added here: the 60px bar always sits above it.
  const { bottom } = useSafeAreaInsets()

  return (
    <View style={styles.frame}>
      <View style={styles.column}>
        <Tabs
          screenListeners={onTabPress ? { tabPress: onTabPress } : undefined}
          screenOptions={{
            headerShown: false,
            tabBarActiveTintColor: colors.brand,
            tabBarInactiveTintColor: colors.textFaint,
            tabBarLabel: (props) => <TabLabel {...props} tabCount={raayonit ? 5 : 4} />,
            tabBarIconStyle: styles.icon,
            tabBarItemStyle: styles.item,
            tabBarStyle: [styles.bar, { height: BAR_HEIGHT + bottom, paddingBottom: BAR_PAD + bottom }],
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

// react-native-web ignores adjustsFontSizeToFit, so the size is also computed from the column: the bar spans
// min(window, 480) split across the visible tabs, and a label gets that width less 4px. The navigator pads the item 5px a side, so the label takes an explicit width (slot + 2) and centres, spilling into that padding.
// ~0.56em per character is a safe average for the system sans at weight 600; the floor keeps it legible.
const BAR_HEIGHT = 60
const BAR_PAD = 6
const COLUMN_MAX = 480
const GLYPH_EM = 0.56
function slotWidth(tabCount: number, windowWidth: number) {
  return Math.min(windowWidth, COLUMN_MAX) / tabCount - 4
}
function labelSize(label: string, tabCount: number, windowWidth: number) {
  const slot = slotWidth(tabCount, windowWidth)
  return Math.max(8, Math.min(11, slot / Math.max(1, label.length * GLYPH_EM)))
}

function TabLabel({ children, color, tabCount }: { color: ColorValue; children: string; tabCount: number }) {
  const { width } = useWindowDimensions()
  return (
    <Text
      numberOfLines={1}
      adjustsFontSizeToFit
      minimumFontScale={0.78}
      allowFontScaling={false}
      style={[styles.label, { color, width: slotWidth(tabCount, width) + 2, fontSize: labelSize(children, tabCount, width) }]}
    >
      {children}
    </Text>
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
  label: { fontSize: 11, fontWeight: '600', marginTop: 2, textAlign: 'center', alignSelf: 'center', flexShrink: 0, maxWidth: 9999 },
  icon: { marginBottom: 0 },
  item: { flex: 1, minWidth: 0, paddingTop: 4, paddingHorizontal: 0 },
  bar: { direction: 'ltr', backgroundColor: colors.white, borderTopWidth: 1, borderTopColor: colors.border },
})

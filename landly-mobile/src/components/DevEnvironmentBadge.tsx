import { StyleSheet, View } from 'react-native'
import Constants from 'expo-constants'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import AppText from './AppText'

// "DEV · landly-dev" in the top trailing corner of development builds
// (Expo Go, `expo start`), so it's always clear which Firebase project the
// app is talking to. The name is the project the app actually loaded
// (app.config.js). Touches pass straight through, screen readers skip it,
// and it follows the language's direction like the rest of the tree.
// Rendered only when __DEV__ (app/_layout.tsx); release builds never show it.
export default function DevEnvironmentBadge() {
  const insets = useSafeAreaInsets()
  const projectId = (Constants.expoConfig?.extra?.firebase as { projectId?: string } | undefined)?.projectId ?? 'no project'
  return (
    <View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.wrap, { top: insets.top + 4 }]}
    >
      <View style={styles.pill}>
        <View style={styles.dot} />
        <AppText ltr style={styles.text}>{`DEV · ${projectId}`}</AppText>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', end: 8, zIndex: 1000, elevation: 1000 },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: 'rgba(11, 27, 61, 0.72)',
  },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#f59e0b' },
  text: { fontSize: 10, lineHeight: 13, fontWeight: '700', color: '#ffffff', letterSpacing: 0.3 },
})

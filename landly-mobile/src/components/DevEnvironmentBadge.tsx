import { StyleSheet, View } from 'react-native'
import Constants from 'expo-constants'
import { useSegments } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import AppText from './AppText'

// "DEV · landly-dev" in the top right corner of development builds, on the
// physical right in every language (opposite the brand lockup on the left)
// (Expo Go, `expo start`), so it's always clear which Firebase project the
// app is talking to. The name is the project the app actually loaded
// (app.config.js). Touches pass straight through, screen readers skip it,
// and it does not mirror in Hebrew.
// Rendered only when __DEV__ (app/_layout.tsx); release builds never show it.
function useProjectId() {
  return (Constants.expoConfig?.extra?.firebase as { projectId?: string } | undefined)?.projectId ?? 'no project'
}

// The pill itself. The primary tabs render it inside their header row (TabHeader), next to
// the trailing icon, so it never covers it; it shrinks (and ellipsizes) on a narrow screen.
export function DevPill() {
  const projectId = useProjectId()
  return (
    <View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.pill}>
      <View style={styles.dot} />
      <AppText ltr numberOfLines={1} style={styles.text}>{`DEV · ${projectId}`}</AppText>
    </View>
  )
}

export default function DevEnvironmentBadge() {
  const insets = useSafeAreaInsets()
  const inTabs = useSegments()[0] === '(tabs)'
  const projectId = useProjectId()
  // On a primary tab the pill lives in the tab header (TabHeader).
  if (inTabs) return null
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
  wrap: { position: 'absolute', left: 0, right: 0, direction: 'ltr', alignItems: 'flex-end', paddingRight: 8, zIndex: 1200, elevation: 1200 },
  pill: {
    flexShrink: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderCurve: 'continuous',
    backgroundColor: 'rgba(11, 27, 61, 0.72)',
  },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#f59e0b' },
  text: { fontSize: 12, lineHeight: 16, fontWeight: '700', color: '#ffffff', letterSpacing: 0.3 },
})

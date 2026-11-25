import type { ReactNode } from 'react'
import { StyleSheet } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import TabHeader, { type TabAction } from './TabHeader'
import { colors } from '../theme'

// The frame of every primary tab (Home, Perks, Raayonit Card, My Pass, Profile):
// the top safe-area inset, the persistent GoLandly brand bar, then the screen's
// own content. One place owns the bar and its insets, so the bar, and the title
// row under it, sit at the same coordinates on every tab and in every language
// and switching tabs never moves them. The bar stays fixed; the screen scrolls
// beneath it. Side insets are the content's own business (useLayout padding), so
// the bar and the content share one column. `action` is the bar's trailing icon:
// the saved-perks heart (default) or, on Profile, the Settings gear.
export default function TabScreen({ action = 'wishlist', children }: { action?: TabAction; children: ReactNode }) {
  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <TabHeader action={action} />
      {children}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
})

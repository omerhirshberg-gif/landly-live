import { StyleSheet, View } from 'react-native'
import BrandLockup from './BrandLockup'
import { DevPill } from './DevEnvironmentBadge'
import SettingsHeaderButton from './SettingsHeaderButton'
import WishlistHeaderButton from './WishlistHeaderButton'
import { useLayout } from '../lib/useLayout'

// The top bar of every primary tab (rendered by TabScreen): the GoLandly lockup
// on the physical left in English and Hebrew alike, like the web Navbar and the
// bottom tab bar, which never mirror. The trailing action (the saved-perks heart
// on Home, Perks, Raayonit Card and My Pass; the Settings gear on Profile) sits on
// the physical right in a fixed 44pt box, so it lands on the same coordinates on
// every tab; the DEV pill of development builds sits in the same row, just left
// of it, and shrinks rather than overlap. It is 48pt tall
// plus 4pt above, always, and takes the same side padding as the screens'
// content (safe-area inset + gutter, capped column), so the lockup lines up with
// the content below it on phones, tablets and foldables.
export const TAB_HEADER_HEIGHT = 48
export const TAB_HEADER_TOP = 4

export type TabAction = 'wishlist' | 'settings'

export default function TabHeader({ action }: { action: TabAction }) {
  const { paddingLeft, paddingRight } = useLayout()
  return (
    <View style={[styles.bar, { paddingLeft, paddingRight }]}>
      <BrandLockup />
      <View style={styles.trailing}>
        {__DEV__ && <DevPill />}
        {action === 'settings' ? <SettingsHeaderButton /> : <WishlistHeaderButton />}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  // direction: 'ltr' pins the lockup to the physical left whatever the root view's direction.
  bar: { direction: 'ltr', height: TAB_HEADER_HEIGHT + TAB_HEADER_TOP, flexDirection: 'row', alignItems: 'center', paddingTop: TAB_HEADER_TOP },
  trailing: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 4 },
})

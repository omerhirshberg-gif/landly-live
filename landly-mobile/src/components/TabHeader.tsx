import { StyleSheet, View } from 'react-native'
import BrandLockup from './BrandLockup'

// The Home and Perks tabs' top bar: the GoLandly × Raayonit lockup on the reading direction's start side
// (web: the Navbar's brand). The trailing side stays free for the DEV pill of development builds
// (components/DevEnvironmentBadge.tsx). Sits under the screen's own top safe-area inset.
export default function TabHeader() {
  return (
    <View style={styles.bar}>
      <BrandLockup />
    </View>
  )
}

const styles = StyleSheet.create({
  bar: { minHeight: 48, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 4 },
})

import { StyleSheet, View } from 'react-native'
import AppText from './AppText'
import { StaticEmblem } from './Emblem'
import { useLang } from '../i18n/LangProvider'
import { colors } from '../theme'

// The solo GoLandly lockup (web: components/layout/BrandLockup.tsx): the star emblem and the wordmark, nothing else. Every primary tab's top bar
// (TabHeader, via TabScreen) wears it; the Raayonit logo lives on the club card, /raayonit and the Raayonit offer, checkout and voucher screens, never in the bar.
// One accessible element, so a screen reader hears it once; the emblem is decorative.
// The vector emblem (star, arch, arrow) only: the raster logo-mark.png carried a second wordmark baked in under the star.
const MARK_HEIGHT = 32
const MARK_WIDTH = Math.round((MARK_HEIGHT * 526) / 512)

export default function BrandLockup() {
  const { t } = useLang()
  return (
    <View style={styles.row} accessible accessibilityRole="header" accessibilityLabel={t('brand_lockup_label')}>
      <View style={styles.mark} accessible={false} importantForAccessibility="no-hide-descendants"><StaticEmblem /></View>
      <AppText ltr numberOfLines={1} style={styles.name}>GoLandly</AppText>
    </View>
  )
}

const styles = StyleSheet.create({
  // Always mark then wordmark on one line, left to right in every language (the web bar is dir=ltr too); never wrapped or stacked.
  row: { flexDirection: 'row', direction: 'ltr', flexWrap: 'nowrap', alignItems: 'center', alignSelf: 'flex-start', gap: 8 },
  mark: { width: MARK_WIDTH, height: MARK_HEIGHT, flexShrink: 0 },
  name: { fontSize: 19, lineHeight: 24, fontWeight: '900', letterSpacing: -0.3, color: colors.brand },
})

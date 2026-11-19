import { Image, StyleSheet, View } from 'react-native'
import AppText from './AppText'
import { useLang } from '../i18n/LangProvider'
import { colors } from '../theme'

// "GoLandly × Raayonit" (web: components/layout/BrandLockup.tsx): the GoLandly mark and name, a 1pt hairline at
// 20% opacity, then the Raayonit logo in a white rounded frame. The top bar of the Home and Perks tabs wears it.
// One accessible element, so a screen reader hears the pair once; the pictures themselves are decorative.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const MARK = require('../../assets/logo-mark.png')
// eslint-disable-next-line @typescript-eslint/no-require-imports
const RAAYONIT = require('../../assets/images/raayonit-logo.png')
const MARK_SIZE = 32
const RAAYONIT_RATIO = 248 / 442
const FRAME_HEIGHT = 40
const LOGO_HEIGHT = 34

export default function BrandLockup() {
  const { t } = useLang()
  return (
    <View style={styles.row} accessible accessibilityRole="header" accessibilityLabel={t('brand_lockup_label')}>
      <Image source={MARK} style={styles.mark} resizeMode="contain" accessible={false} />
      <AppText ltr style={styles.name}>GoLandly</AppText>
      <View style={styles.divider} />
      <View style={styles.frame}>
        <Image source={RAAYONIT} style={styles.raayonit} resizeMode="contain" accessible={false} />
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  mark: { width: MARK_SIZE, height: MARK_SIZE },
  name: { fontSize: 19, lineHeight: 24, fontWeight: '900', letterSpacing: -0.3, color: colors.brand },
  divider: { width: 1, height: 24, marginHorizontal: 4, backgroundColor: colors.heading, opacity: 0.2 },
  frame: {
    height: FRAME_HEIGHT,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: colors.borderLight,
    backgroundColor: colors.white,
  },
  raayonit: { width: LOGO_HEIGHT * RAAYONIT_RATIO, height: LOGO_HEIGHT },
})

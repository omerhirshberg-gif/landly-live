import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native'
import AppText from './AppText'
import LineIcon from './LineIcon'
import { useLang } from '../i18n/LangProvider'
import { colors } from '../theme'

// Raayonit launch-pending notice (web: components/raayonit/ComingSoonNotice.tsx). Shown wherever the card could be bought while
// `comingSoon` is on: the card, every value and every business stay visible, only the purchase waits.
export default function ComingSoonNotice({ compact = false, style }: { compact?: boolean; style?: StyleProp<ViewStyle> }) {
  const { t } = useLang()
  return (
    <View accessibilityRole="alert" style={[styles.box, style]}>
      <View style={styles.icon}><LineIcon name="clock" size={18} color={colors.brand} strokeWidth={1.75} /></View>
      <View style={styles.copy}>
        <AppText style={styles.title}>{t('raayonit_coming_soon_title')}</AppText>
        {!compact && <AppText style={styles.body}>{t('raayonit_coming_soon_body')}</AppText>}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  box: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 16, borderCurve: 'continuous', borderWidth: 1, borderColor: 'rgba(191,219,254,0.8)', backgroundColor: 'rgba(239,246,255,0.8)' },
  icon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(191,219,254,0.8)', backgroundColor: '#FFFFFF' },
  copy: { flex: 1, minWidth: 0 },
  title: { fontSize: 14, lineHeight: 20, fontWeight: '800', color: colors.heading, textAlign: 'auto' },
  body: { marginTop: 2, fontSize: 13, lineHeight: 20, color: colors.body, textAlign: 'auto' },
})

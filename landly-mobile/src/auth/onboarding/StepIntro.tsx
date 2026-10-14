import { StyleSheet, View } from 'react-native'
import AppText from '../../components/AppText'
import { colors } from '../../theme'

// Each step's title and one-line subtitle. `compact` (keyboard up, or a
// short screen) drops the subtitle so the step still fits without scrolling.
export default function StepIntro({ title, subtitle, compact }: { title: string; subtitle?: string; compact?: boolean }) {
  return (
    <View style={compact ? styles.wrapCompact : styles.wrap}>
      <AppText accessibilityRole="header" style={styles.title}>
        {title}
      </AppText>
      {subtitle && !compact && <AppText style={styles.subtitle}>{subtitle}</AppText>}
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 20 },
  wrapCompact: { marginBottom: 14 },
  title: { fontSize: 22, lineHeight: 28, fontWeight: '800', color: colors.textStrong },
  subtitle: { marginTop: 4, fontSize: 14, lineHeight: 20, color: colors.textMuted },
})

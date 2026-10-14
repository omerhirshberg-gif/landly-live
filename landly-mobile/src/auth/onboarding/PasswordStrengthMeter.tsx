import { StyleSheet, View } from 'react-native'
import type { PasswordStrength } from '@shared/auth/onboarding'
import type { TranslationKey } from '@shared/i18n/translations'
import AppText from '../../components/AppText'
import { useLang } from '../../i18n/LangProvider'
import { colors } from '../../theme'

const LEVELS: Record<Exclude<PasswordStrength, 0>, { key: TranslationKey; color: string }> = {
  1: { key: 'onb_strength_weak', color: '#ef4444' },
  2: { key: 'onb_strength_fair', color: '#f59e0b' },
  3: { key: 'onb_strength_strong', color: '#10b981' },
}

// Three bars and a one-word verdict under the password field; empty until
// the first character is typed.
export default function PasswordStrengthMeter({ strength }: { strength: PasswordStrength }) {
  const { t, isRtl } = useLang()
  const level = strength ? LEVELS[strength] : null
  return (
    <View style={styles.row} accessibilityLiveRegion="polite">
      <View style={styles.bars}>
        {[1, 2, 3].map((n) => (
          <View key={n} style={[styles.bar, { backgroundColor: level && n <= strength ? level.color : colors.border }]} />
        ))}
      </View>
      <AppText
        style={[styles.label, { color: level ? level.color : 'transparent', textAlign: isRtl ? 'left' : 'right' }]}
        accessibilityLabel={level ? `${t('onb_strength_label')}: ${t(level.key)}` : undefined}
      >
        {level ? t(level.key) : ' '}
      </AppText>
    </View>
  )
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: -6, marginBottom: 20 },
  bars: { flex: 1, flexDirection: 'row', gap: 6 },
  bar: { flex: 1, height: 6, borderRadius: 3 },
  // Aligned to the row's end edge (left in RTL).
  label: { minWidth: 56, fontSize: 12, fontWeight: '700' },
})

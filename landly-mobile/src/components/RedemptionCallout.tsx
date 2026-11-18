import { StyleSheet, View } from 'react-native'
import { needsAdvanceNotice, isolateNumbers } from '@shared/inventory/raayonitRedemption'
import { REDEMPTION_METHOD_LABEL_KEYS, instructionSteps, type RedemptionMethod } from '@shared/offers/redemption'
import AppText from './AppText'
import ContentText from './ContentText'
import LineIcon from './LineIcon'
import { useLang } from '../i18n/LangProvider'
import { colors } from '../theme'

// What the buyer must do before paying, right in the offer's summary: book through Raayonit, book a time, or order by phone.
// Plain and neutral: one icon, the method, the key lines of the merchant's own instructions. Web: components/offers/RedemptionCallout.tsx.
export default function RedemptionCallout({ method, instructions, contentLang }: { method: RedemptionMethod; instructions: string; contentLang?: string | null }) {
  const { t } = useLang()
  if (!needsAdvanceNotice(method)) return null
  const steps = instructionSteps(instructions)
  // The booking line, plus any line that states a limit (such as "up to 50%").
  const lines = steps.length > 0 ? [steps[0]!, ...steps.slice(1).filter((s) => /%/.test(s))] : []
  return (
    <View style={styles.box} accessible accessibilityRole="summary">
      <View style={styles.badge}>
        <LineIcon name={method === 'phone_order' ? 'phone' : 'calendar'} size={18} color={colors.brand} strokeWidth={1.75} />
      </View>
      <View style={styles.copy}>
        <AppText style={styles.title}>{t(REDEMPTION_METHOD_LABEL_KEYS[method])}</AppText>
        {lines.map((line, i) => (
          <ContentText key={i} contentLang={contentLang ?? null} style={styles.text}>{isolateNumbers(line)}</ContentText>
        ))}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  box: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginTop: 14, padding: 14, borderRadius: 16, borderCurve: 'continuous', borderWidth: 1, borderColor: '#E2E8F0', backgroundColor: '#F8FAFC' },
  badge: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.brandTint },
  copy: { flex: 1, gap: 4 },
  title: { fontSize: 14, lineHeight: 19, fontWeight: '700', color: colors.textStrong },
  text: { fontSize: 14, lineHeight: 20, color: colors.body },
})

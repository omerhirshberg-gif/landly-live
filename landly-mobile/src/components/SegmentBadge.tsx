import { StyleSheet, View } from 'react-native'
import { CUSTOMER_TYPES, CUSTOMER_TYPE_UNSET_COLOR, customerTypeLabel } from '@shared/customerTypes'
import AppText from './AppText'
import { useLang } from '../i18n/LangProvider'
import { colors, radius } from '../theme'

// The member's persona (Student, Developer, …) as a pill in its own colour,
// on My Pass and Profile (web: components/member/SegmentBadge.tsx). "Other"
// shows what the member typed for it; no answer yet shows "Member" in grey.
export default function SegmentBadge({ customerType, customerTypeOther }: { customerType?: string; customerTypeOther?: string }) {
  const { t } = useLang()
  const type = customerType ?? ''
  const label = customerTypeLabel(type, customerTypeOther ?? '', t) ?? t('dash_segment_value_unset')
  const color = CUSTOMER_TYPES.find((o) => o.value === type)?.color ?? CUSTOMER_TYPE_UNSET_COLOR

  return (
    <View style={[styles.badge, { backgroundColor: color }]}>
      <AppText style={styles.text} numberOfLines={1}>
        {label}
      </AppText>
    </View>
  )
}

const styles = StyleSheet.create({
  // Solid type colour, white text (web: .segment-badge).
  badge: { maxWidth: '100%', paddingHorizontal: 13, paddingVertical: 5, borderRadius: radius.pill },
  text: { fontSize: 12, fontWeight: '800', color: colors.white },
})

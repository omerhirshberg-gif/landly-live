import { StyleSheet, View } from 'react-native'
import Svg, { Path } from 'react-native-svg'
import { ONB_ICONS, type OnbIcon } from '@shared/brand/onboardingIcons'
import AppText from '../../components/AppText'
import { colors } from '../../theme'

// Icon + one line, for the welcome card's promises and the notifications
// card's benefits (web: components/auth/onboarding/PointList.tsx).
export default function PointList({ points }: { points: { icon: OnbIcon; label: string }[] }) {
  return (
    <View style={styles.list}>
      {points.map((point) => (
        <View key={point.icon} style={styles.item}>
          <View style={styles.icon}>
            <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={colors.brand} strokeWidth={2.25} strokeLinecap="round" strokeLinejoin="round">
              <Path d={ONB_ICONS[point.icon]} />
            </Svg>
          </View>
          <AppText style={styles.text}>{point.label}</AppText>
        </View>
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  list: { gap: 10, marginBottom: 24 },
  item: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  icon: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.brandLight, alignItems: 'center', justifyContent: 'center' },
  text: { flexShrink: 1, fontSize: 15, lineHeight: 20, fontWeight: '600', color: colors.text },
})

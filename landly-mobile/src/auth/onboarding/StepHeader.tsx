import { Pressable, StyleSheet, View } from 'react-native'
import Animated, { cubicBezier } from 'react-native-reanimated'
import Svg, { Path } from 'react-native-svg'
import { stepProgress, type OnboardingStep } from '@shared/auth/onboarding'
import AppText from '../../components/AppText'
import { StaticEmblem } from '../../components/Emblem'
import { useLang } from '../../i18n/LangProvider'
import { webOnly } from '../../lib/webStyles'
import { colors } from '../../theme'

const EASE_OUT = cubicBezier(0.23, 1, 0.32, 1)

// Back arrow, "Step 2 of 4" and a progress bar, with a small emblem standing
// in for the brand hero. `onBack` is null where there's no going back.
export default function StepHeader({
  step,
  onBack,
}: {
  step: OnboardingStep
  onBack: (() => void) | null
}) {
  const { t, isRtl } = useLang()
  const { current, total } = stepProgress(step)
  const label = t('onb_stepOf').replace('{current}', String(current)).replace('{total}', String(total))
  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        {onBack ? (
          <Pressable accessibilityRole="button" accessibilityLabel={t('onb_back')} onPress={onBack} hitSlop={8} style={styles.back}>
            <Svg
              width={22}
              height={22}
              viewBox="0 0 24 24"
              fill="none"
              stroke={colors.text}
              strokeWidth={2.25}
              strokeLinecap="round"
              strokeLinejoin="round"
              style={isRtl && styles.flip}
            >
              <Path d="M19 12H5M12 19l-7-7 7-7" />
            </Svg>
          </Pressable>
        ) : (
          <View style={styles.backSpacer} />
        )}
        <AppText style={styles.label}>{label}</AppText>
        <View style={styles.emblem} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <StaticEmblem />
        </View>
      </View>
      <View
        accessibilityRole="progressbar"
        accessibilityLabel={label}
        accessibilityValue={{ min: 1, max: total, now: current }}
        style={styles.track}
      >
        <Animated.View
          style={[
            styles.fill,
            {
              width: `${(current / total) * 100}%`,
              transitionProperty: 'width',
              transitionDuration: 300,
              transitionTimingFunction: EASE_OUT,
            },
          ]}
        />
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 16 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  back: {
    width: 40,
    height: 40,
    marginStart: -8,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    ...webOnly({ cursor: 'pointer' }),
  },
  backSpacer: { width: 2, height: 40 },
  flip: { transform: [{ scaleX: -1 }] },
  label: { flex: 1, fontSize: 13, fontWeight: '600', color: colors.textMuted },
  emblem: { width: 32, height: 32 },
  track: { height: 6, borderRadius: 3, backgroundColor: colors.borderLight, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 3, backgroundColor: colors.brand },
})

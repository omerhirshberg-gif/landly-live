import { Pressable, StyleSheet, View } from 'react-native'
import Animated from 'react-native-reanimated'
import { onboardingProgress, type OnboardingStep } from '@shared/auth/onboarding'
import { ONB } from '@shared/brand/onboardingMotion'
import { StaticEmblem } from '../../components/Emblem'
import DirectionalIcon from '../../components/DirectionalIcon'
import { useLang } from '../../i18n/LangProvider'
import { webOnly } from '../../lib/webStyles'
import { colors } from '../../theme'
import { SILK_CSS } from './motion'

// Back arrow and a small emblem standing in for the brand hero, over a slim
// progress line that fills continuously across every card: empty on the
// welcome, full on the celebration. No "Step 2 of 4" count, so the welcome
// and celebration never read as outside the flow. `onBack` is null where
// there's no going back.
export default function StepHeader({ step, onBack }: { step: OnboardingStep; onBack: (() => void) | null }) {
  const { t } = useLang()
  const percent = Math.round(onboardingProgress(step) * 100)
  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        {onBack ? (
          <Pressable accessibilityRole="button" accessibilityLabel={t('onb_back')} onPress={onBack} hitSlop={8} style={styles.back}>
            <DirectionalIcon name="arrowStart" size={22} color={colors.text} strokeWidth={2.25} />
          </Pressable>
        ) : (
          <View style={styles.backSpacer} />
        )}
        <View style={styles.emblem} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <StaticEmblem />
        </View>
      </View>
      <View
        accessibilityRole="progressbar"
        accessibilityLabel={t('onb_progress')}
        accessibilityValue={{ min: 0, max: 100, now: percent }}
        style={styles.track}
      >
        <Animated.View
          style={[
            styles.fill,
            {
              width: `${percent}%`,
              transitionProperty: 'width',
              transitionDuration: ONB.progressMs,
              transitionTimingFunction: SILK_CSS,
            },
          ]}
        />
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 16 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 10 },
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
  emblem: { width: 32, height: 32 },
  track: { height: 3, borderRadius: 1.5, backgroundColor: colors.borderLight, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 1.5, backgroundColor: colors.brand },
})

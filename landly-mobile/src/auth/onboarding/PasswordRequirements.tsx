import { useEffect, useState } from 'react'
import { StyleSheet, View } from 'react-native'
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated'
import Svg, { Path } from 'react-native-svg'
import { PASSWORD_REQUIREMENT_ITEMS, passwordRequirements } from '@shared/auth/passwordValidation'
import { EASE_SILK } from '@shared/brand/onboardingMotion'
import AppText from '../../components/AppText'
import { useLang } from '../../i18n/LangProvider'
import { colors } from '../../theme'

const MET = '#10b981' // emerald-500
const MET_TEXT = '#059669' // emerald-600
const UNMET_BORDER = '#cbd5e1' // slate-300, as on web
const OPEN_MS = 220
// Open, the list tucks this far under the field above (whose bottom margin is 16).
const TUCK = -6
const SILK = Easing.bezier(...EASE_SILK)

// The four password rules under the password field, each ticking green as
// it's met (lib/auth/passwordValidation.ts). Two per row, wrapping on the
// narrowest phones; rows follow the root view's direction, so Hebrew starts
// on the right. Native counterpart of
// components/auth/onboarding/PasswordRequirements.tsx.
//
// Shown only while the field is focused (`visible`); otherwise it takes no
// space. The list is measured once laid out, and the wrapper animates its
// height and opacity to it on the silk curve (instant with reduced motion).
// Collapsed, it's hidden from screen readers.
export default function PasswordRequirements({ password, visible }: { password: string; visible: boolean }) {
  const { t } = useLang()
  const reduced = useReducedMotion()
  const met = passwordRequirements(password)
  const [contentHeight, setContentHeight] = useState(0)
  const progress = useSharedValue(visible ? 1 : 0)

  useEffect(() => {
    progress.set(reduced ? (visible ? 1 : 0) : withTiming(visible ? 1 : 0, { duration: OPEN_MS, easing: SILK }))
  }, [visible, reduced, progress])

  const wrapStyle = useAnimatedStyle(() => ({
    height: progress.get() * contentHeight,
    marginTop: progress.get() * TUCK,
    opacity: progress.get(),
  }))

  return (
    <Animated.View
      style={[styles.wrap, wrapStyle]}
      accessibilityElementsHidden={!visible}
      importantForAccessibility={visible ? 'auto' : 'no-hide-descendants'}
      pointerEvents="none"
    >
      {/* Absolute, so it lays out at its full height even while the wrapper is collapsed. */}
      <View style={styles.measure} onLayout={(e) => setContentHeight(e.nativeEvent.layout.height)}>
        <View style={styles.list} accessibilityLabel={t('onb_pwReq_title')}>
          {PASSWORD_REQUIREMENT_ITEMS.map(({ key, label }) => (
            <View
              key={key}
              style={styles.item}
              accessible
              accessibilityLabel={`${t(label)}: ${t(met[key] ? 'onb_pwReq_met' : 'onb_pwReq_unmet')}`}
            >
              <View style={[styles.dot, met[key] && styles.dotMet]}>
                {met[key] && (
                  <Svg width={10} height={10} viewBox="0 0 24 24" fill="none" stroke={colors.white} strokeWidth={3.5} strokeLinecap="round" strokeLinejoin="round">
                    <Path d="M20 6 9 17l-5-5" />
                  </Svg>
                )}
              </View>
              <AppText style={[styles.label, met[key] && styles.labelMet]}>{t(label)}</AppText>
            </View>
          ))}
        </View>
      </View>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  // Open, 20 sits between the list and the next field (as the old strength meter had).
  wrap: { overflow: 'hidden' },
  measure: { position: 'absolute', top: 0, start: 0, end: 0, paddingBottom: 20 },
  list: { flexDirection: 'row', flexWrap: 'wrap', rowGap: 6 },
  item: { width: '50%', minWidth: 150, flexGrow: 1, flexDirection: 'row', alignItems: 'center', gap: 6, paddingEnd: 8 },
  dot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: UNMET_BORDER,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotMet: { backgroundColor: MET, borderColor: MET },
  label: { flexShrink: 1, fontSize: 12, fontWeight: '600', color: colors.textMuted },
  labelMet: { color: MET_TEXT },
})

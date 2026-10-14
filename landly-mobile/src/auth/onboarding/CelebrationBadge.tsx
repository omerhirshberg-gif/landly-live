import { useEffect } from 'react'
import { StyleSheet, View } from 'react-native'
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated'
import Svg, { Path } from 'react-native-svg'
import { ONB_ICONS } from '@shared/brand/onboardingIcons'
import { CELEBRATE_FROM_SCALE, CELEBRATE_SPRING, ONB } from '@shared/brand/onboardingMotion'
import { colors } from '../../theme'
import { FADE, SILK } from './motion'

const BREATHE = Easing.inOut(Easing.ease)

// The celebration card's glowing badge (web: .badge / .halo in
// entrance.module.css). The badge lands on CELEBRATE_SPRING — just over
// critically damped, so there's no bounce — while its halo of soft brand rings
// swells in and then breathes slowly. Reduced motion: a plain fade, no loop.
export default function CelebrationBadge() {
  const reduced = useReducedMotion()
  const opacity = useSharedValue(0)
  const scale = useSharedValue(reduced ? 1 : CELEBRATE_FROM_SCALE)
  const halo = useSharedValue(0)
  const haloScale = useSharedValue(reduced ? 1 : 0.7)

  useEffect(() => {
    const delay = ONB.stepInDelayMs
    if (reduced) {
      opacity.set(withTiming(1, { duration: ONB.reducedMs }))
      halo.set(withTiming(1, { duration: ONB.reducedMs }))
      return
    }
    opacity.set(withDelay(delay, withTiming(1, { duration: ONB.stepInMs, easing: FADE })))
    scale.set(withDelay(delay, withSpring(1, CELEBRATE_SPRING)))
    halo.set(
      withDelay(
        delay,
        withSequence(
          withTiming(1, { duration: ONB.haloInMs, easing: SILK }),
          withRepeat(withTiming(0.6, { duration: ONB.haloBreatheMs, easing: BREATHE }), -1, true)
        )
      )
    )
    haloScale.set(
      withDelay(
        delay,
        withSequence(
          withTiming(1, { duration: ONB.haloInMs, easing: SILK }),
          withRepeat(withTiming(1.07, { duration: ONB.haloBreatheMs, easing: BREATHE }), -1, true)
        )
      )
    )
  }, [reduced, opacity, scale, halo, haloScale])

  const badgeStyle = useAnimatedStyle(() => ({ opacity: opacity.get(), transform: [{ scale: scale.get() }] }))
  const haloStyle = useAnimatedStyle(() => ({ opacity: halo.get(), transform: [{ scale: haloScale.get() }] }))

  return (
    <View style={styles.wrap} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Animated.View style={[styles.halo, haloStyle]}>
        <View style={[styles.ring, styles.ringOuter]} />
        <View style={[styles.ring, styles.ringMid]} />
        <View style={[styles.ring, styles.ringInner]} />
      </Animated.View>
      <Animated.View style={[styles.badge, badgeStyle]}>
        <View style={styles.clip}>
          <View style={styles.sheen} />
        </View>
        <Svg width={40} height={40} viewBox="0 0 24 24" fill="none" stroke={colors.white} strokeWidth={2.75} strokeLinecap="round" strokeLinejoin="round">
          <Path d={ONB_ICONS.check} />
        </Svg>
      </Animated.View>
    </View>
  )
}

const SIZE = 88
const HALO = SIZE + 44

const styles = StyleSheet.create({
  wrap: { width: SIZE, height: SIZE, alignSelf: 'center', marginTop: 4, marginBottom: 20 },
  halo: { position: 'absolute', width: HALO, height: HALO, left: -22, top: -22, alignItems: 'center', justifyContent: 'center' },
  ring: { position: 'absolute', borderRadius: 9999, backgroundColor: colors.brand },
  ringOuter: { width: HALO, height: HALO, opacity: 0.05 },
  ringMid: { width: SIZE + 26, height: SIZE + 26, opacity: 0.08 },
  ringInner: { width: SIZE + 12, height: SIZE + 12, opacity: 0.12 },
  badge: {
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE / 2,
    backgroundColor: colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 14px 30px -10px rgba(0, 56, 184, 0.6)',
  },
  clip: { ...StyleSheet.absoluteFill, borderRadius: SIZE / 2, overflow: 'hidden' },
  // A lighter upper half, standing in for the web badge's gradient.
  sheen: { position: 'absolute', top: -SIZE / 2, left: -SIZE / 4, width: SIZE * 1.5, height: SIZE, borderRadius: SIZE, backgroundColor: 'rgba(255, 255, 255, 0.12)' },
})

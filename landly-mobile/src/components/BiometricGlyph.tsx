import { useEffect } from 'react'
import { Pressable, StyleSheet, View } from 'react-native'
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated'
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg'
import type { BiometricKind } from '../auth/biometricLock'
import LineIcon from './LineIcon'
import { impact } from '../lib/haptics'
import { webOnly } from '../lib/webStyles'
import { colors } from '../theme'

const TILE = 84
const GLYPH = 44
const INNER_RING = 112
const OUTER_RING = 140
const PULSE_MS = 1400
/** One breath: out and back over 2.4s. */
const BREATH_MS = 1200

// The lock screen's hero: the device's biometric glyph (Face ID / face
// unlock, or Touch ID / fingerprint) at 44pt on an 84pt tile lit from the
// centre, inside two faint concentric rings. At rest the outer ring breathes
// gently; while the system prompt is open a soft ring pulses out from the
// tile instead, so the screen shows it's waiting on the member. Reduced
// motion keeps both still. Tapping the tile (a light haptic) asks, like the
// Unlock button; nothing here asks on its own.
export default function BiometricGlyph({
  kind,
  pulsing,
  onPress,
  label,
}: {
  kind: BiometricKind
  pulsing: boolean
  onPress: () => void
  label: string
}) {
  const reduced = useReducedMotion()
  const progress = useSharedValue(0)
  const breath = useSharedValue(0)

  useEffect(() => {
    if (pulsing && !reduced) {
      progress.set(0)
      progress.set(withRepeat(withTiming(1, { duration: PULSE_MS, easing: Easing.out(Easing.quad) }), -1, false))
    } else {
      cancelAnimation(progress)
      progress.set(withTiming(0, { duration: 150 }))
    }
  }, [pulsing, reduced, progress])

  useEffect(() => {
    if (!pulsing && !reduced) {
      breath.set(withRepeat(withTiming(1, { duration: BREATH_MS, easing: Easing.inOut(Easing.sin) }), -1, true))
    } else {
      cancelAnimation(breath)
      breath.set(withTiming(0, { duration: 200 }))
    }
  }, [pulsing, reduced, breath])

  const ringStyle = useAnimatedStyle(() => ({
    opacity: 0.45 * (1 - progress.get()),
    transform: [{ scale: 1 + 0.35 * progress.get() }],
  }))
  const breathStyle = useAnimatedStyle(() => ({
    opacity: 1 - 0.35 * breath.get(),
    transform: [{ scale: 1 + 0.04 * breath.get() }],
  }))

  const face = kind === 'faceId' || kind === 'face'

  return (
    <View style={styles.wrap}>
      <Animated.View pointerEvents="none" style={[styles.outerRing, breathStyle]} />
      <View pointerEvents="none" style={styles.innerRing} />
      <Animated.View pointerEvents="none" style={[styles.ring, ringStyle]} />
      <Pressable
        onPress={() => {
          impact()
          onPress()
        }}
        accessibilityRole="button"
        accessibilityLabel={label}
        hitSlop={8}
        style={({ pressed }) => [styles.tile, pressed && styles.tilePressed]}
      >
        <Svg width={TILE} height={TILE} style={StyleSheet.absoluteFill} pointerEvents="none">
          <Defs>
            <RadialGradient id="landlyGlyphLight" cx="50%" cy="42%" r="58%">
              <Stop offset="0" stopColor="#f2f7ff" />
              <Stop offset="1" stopColor="#d6e6fd" />
            </RadialGradient>
          </Defs>
          <Rect width={TILE} height={TILE} fill="url(#landlyGlyphLight)" />
        </Svg>
        <LineIcon name={face ? 'faceId' : 'fingerprint'} size={GLYPH} color={colors.brand} strokeWidth={1.5} />
      </Pressable>
    </View>
  )
}

const ring = (size: number) => ({ position: 'absolute' as const, width: size, height: size, borderRadius: size / 2 })

const styles = StyleSheet.create({
  wrap: { width: OUTER_RING, height: OUTER_RING, alignItems: 'center', justifyContent: 'center' },
  outerRing: { ...ring(OUTER_RING), borderWidth: 1, borderColor: 'rgba(0, 56, 184, 0.06)', backgroundColor: 'rgba(0, 56, 184, 0.02)' },
  innerRing: { ...ring(INNER_RING), borderWidth: 1, borderColor: 'rgba(0, 56, 184, 0.12)', backgroundColor: 'rgba(0, 56, 184, 0.03)' },
  ring: { ...ring(TILE), borderWidth: 2, borderColor: colors.brand },
  tile: {
    width: TILE,
    height: TILE,
    borderRadius: TILE / 2,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(0, 56, 184, 0.10)',
    backgroundColor: colors.brandLight,
    alignItems: 'center',
    justifyContent: 'center',
    ...webOnly({ cursor: 'pointer' }),
  },
  tilePressed: { opacity: 0.85, transform: [{ scale: 0.96 }] },
})

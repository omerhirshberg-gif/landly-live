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
import type { BiometricKind } from '../auth/biometricLock'
import LineIcon from './LineIcon'
import { colors } from '../theme'

const TILE = 104
const GLYPH = 56
const PULSE_MS = 1400

// The lock screen's hero: the device's biometric glyph (Face ID / face
// unlock, or Touch ID / fingerprint) at 56pt on a round brand-tint tile.
// While the system prompt is open a soft ring breathes out from the tile, so
// the screen shows it's waiting on the member; reduced motion keeps it
// still. Tapping it tries again, like the Sign In button.
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

  useEffect(() => {
    if (pulsing && !reduced) {
      progress.set(0)
      progress.set(withRepeat(withTiming(1, { duration: PULSE_MS, easing: Easing.out(Easing.quad) }), -1, false))
    } else {
      cancelAnimation(progress)
      progress.set(withTiming(0, { duration: 150 }))
    }
  }, [pulsing, reduced, progress])

  const ringStyle = useAnimatedStyle(() => ({
    opacity: 0.45 * (1 - progress.get()),
    transform: [{ scale: 1 + 0.35 * progress.get() }],
  }))

  const face = kind === 'faceId' || kind === 'face'

  return (
    <View style={styles.wrap}>
      <Animated.View pointerEvents="none" style={[styles.ring, ringStyle]} />
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={label}
        hitSlop={8}
        style={({ pressed }) => [styles.tile, pressed && styles.tilePressed]}
      >
        <LineIcon name={face ? 'faceId' : 'fingerprint'} size={GLYPH} color={colors.brand} strokeWidth={1.5} />
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { width: TILE, height: TILE, alignItems: 'center', justifyContent: 'center' },
  ring: {
    position: 'absolute',
    width: TILE,
    height: TILE,
    borderRadius: TILE / 2,
    borderWidth: 2,
    borderColor: colors.brand,
  },
  tile: {
    width: TILE,
    height: TILE,
    borderRadius: TILE / 2,
    backgroundColor: colors.brandTint,
    borderWidth: 1,
    borderColor: colors.brandLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tilePressed: { backgroundColor: colors.brandLight, transform: [{ scale: 0.96 }] },
})

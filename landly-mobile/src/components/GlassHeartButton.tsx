import { BlurView } from 'expo-blur'
import { Platform, Pressable, StyleSheet, View } from 'react-native'
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withSequence, withSpring } from 'react-native-reanimated'
import { GlassFallback } from './GlassBackButton'
import LineIcon from './LineIcon'
import { impact } from '../lib/haptics'
import { webOnly } from '../lib/webStyles'
import { colors, hairline } from '../theme'

const isIos = Platform.OS === 'ios'

// A tap dips the circle, and saving gives the heart a short pop.
const PRESS_SPRING = { damping: 18, stiffness: 420, mass: 0.6 }
const POP_SPRING = { damping: 9, stiffness: 380, mass: 0.6 }

// The offer screen's save button, floating over the picture: a 42pt circle in
// a 48pt touch target (web: the heart on app/offers/[offerId]/page.tsx).
// - iOS: the same glass as GlassBackButton -- the system chrome material
//   blurring the picture under it, a hairline specular rim, an ambient shadow.
// - Android and web: a near-opaque white circle, no faux blur.
// An outline heart in ink until saved, then a solid red one. The press and
// the pop are skipped under Reduce Motion; the light haptic on a toggle stays.
export default function GlassHeartButton({
  saved,
  onToggle,
  label,
  style,
}: {
  saved: boolean
  onToggle: () => void
  label: string
  style?: object
}) {
  const reduced = useReducedMotion()
  const scale = useSharedValue(1)
  const scaleStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }] }))

  const press = (value: number) => {
    if (!reduced) scale.set(withSpring(value, PRESS_SPRING))
  }

  const toggle = () => {
    // Saving pops past rest and settles; un-saving just settles.
    if (!reduced) scale.set(saved ? withSpring(1, PRESS_SPRING) : withSequence(withSpring(1.14, POP_SPRING), withSpring(1, PRESS_SPRING)))
    impact()
    onToggle()
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: saved }}
      onPress={toggle}
      onPressIn={() => press(0.9)}
      onPressOut={() => press(1)}
      style={[styles.target, style]}
    >
      <Animated.View style={[styles.shadow, scaleStyle]}>
        <View style={styles.surface}>
          {isIos && (
            <GlassFallback>
              <BlurView tint="systemChromeMaterial" intensity={80} style={StyleSheet.absoluteFill} />
            </GlassFallback>
          )}
          <LineIcon name="heart" size={20} color={saved ? colors.heart : colors.heading} fill={saved ? colors.heart : 'none'} strokeWidth={2} />
        </View>
      </Animated.View>
    </Pressable>
  )
}

const SIZE = 42

const styles = StyleSheet.create({
  target: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center', ...webOnly({ cursor: 'pointer' }) },
  // Casts the shadow; the surface inside clips the blur to the circle (a
  // clipping view can't cast one on iOS).
  shadow: {
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE / 2,
    backgroundColor: isIos ? 'rgba(255, 255, 255, 0.2)' : 'rgba(255, 255, 255, 0.94)',
    shadowColor: colors.textStrong,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.16,
    shadowRadius: 10,
    elevation: 3,
  },
  surface: {
    flex: 1,
    borderRadius: SIZE / 2,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: hairline,
    borderColor: 'rgba(255, 255, 255, 0.6)',
  },
})

import type { ReactNode } from 'react'
import { Pressable, type PressableProps, type StyleProp, type ViewStyle } from 'react-native'
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withSpring } from 'react-native-reanimated'

const AnimatedPressable = Animated.createAnimatedComponent(Pressable)

// Snappy on the way down, a touch of settle on release; on the UI thread so
// it never waits on JS. Reduce Motion keeps the press static.
const PRESS_SPRING = { damping: 18, stiffness: 420, mass: 0.6 }

// A Pressable that springs down to `pressedScale` while held (category
// cards, rail tiles).
export default function ScalePressable({
  pressedScale = 0.97,
  style,
  children,
  onPressIn,
  onPressOut,
  ...props
}: Omit<PressableProps, 'style' | 'children'> & { pressedScale?: number; style?: StyleProp<ViewStyle>; children: ReactNode }) {
  const reduced = useReducedMotion()
  const scale = useSharedValue(1)
  const animated = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }] }))
  return (
    <AnimatedPressable
      {...props}
      onPressIn={(e) => {
        if (!reduced) scale.set(withSpring(pressedScale, PRESS_SPRING))
        onPressIn?.(e)
      }}
      onPressOut={(e) => {
        if (!reduced) scale.set(withSpring(1, PRESS_SPRING))
        onPressOut?.(e)
      }}
      style={[style, animated]}
    >
      {children}
    </AnimatedPressable>
  )
}

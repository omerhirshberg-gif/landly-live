import { useEffect } from 'react'
import { StyleSheet, View } from 'react-native'
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated'

// The "live" status dot beside "Available now" (web: .live-dot in app/globals.css): an 8pt emerald core with a soft halo that swells and fades
// once every 1.8 seconds, on the UI thread. Still under Reduce Motion. Decorative: hidden from screen readers.
const GREEN = '#10B981'

export default function LiveDot() {
  const reduce = useReducedMotion()
  const phase = useSharedValue(0)
  useEffect(() => {
    if (reduce) { phase.value = 0; return }
    phase.value = withRepeat(withTiming(1, { duration: 1800, easing: Easing.out(Easing.quad) }), -1, false)
  }, [reduce, phase])
  const halo = useAnimatedStyle(() => ({ opacity: reduce ? 0 : 0.55 * (1 - phase.value), transform: [{ scale: 1 + 1.6 * phase.value }] }))
  return (
    <View style={styles.box} accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Animated.View style={[styles.halo, halo]} />
      <View style={styles.core} />
    </View>
  )
}

const styles = StyleSheet.create({
  box: { width: 18, height: 18, alignItems: 'center', justifyContent: 'center' },
  halo: { position: 'absolute', width: 8, height: 8, borderRadius: 4, backgroundColor: GREEN },
  core: { width: 8, height: 8, borderRadius: 4, backgroundColor: GREEN },
})

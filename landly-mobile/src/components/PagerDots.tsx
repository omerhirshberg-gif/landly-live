import { Pressable, StyleSheet, View } from 'react-native'
import Animated, { Extrapolation, interpolate, interpolateColor, useAnimatedStyle, type SharedValue } from 'react-native-reanimated'
import { useLang } from '../i18n/LangProvider'
import { colors } from '../theme'

const DOT = 6
const ACTIVE = 24

// iOS-style pagination dots under a swipe row (web: components/ui/SnapDots.tsx):
// the dot for where the row is stretches into a 24pt brand pill and the rest
// are 6pt slate circles. `position` is the row's place in resting positions
// (carouselPage), updated on the UI thread as the finger moves, so the pill
// slides between dots with the swipe rather than jumping when it settles.
// Each dot brings its place into view. They follow the row's direction, so
// they mirror with it in Hebrew.
export default function PagerDots({ count, position, onSelect }: { count: number; position: SharedValue<number>; onSelect: (index: number) => void }) {
  const { t } = useLang()
  return (
    <View style={styles.row}>
      {Array.from({ length: count }, (_, i) => (
        <Dot
          key={i}
          index={i}
          position={position}
          label={t('landing_dots_label').replace('{n}', String(i + 1)).replace('{total}', String(count))}
          onPress={() => onSelect(i)}
        />
      ))}
    </View>
  )
}

function Dot({ index, position, label, onPress }: { index: number; position: SharedValue<number>; label: string; onPress: () => void }) {
  const style = useAnimatedStyle(() => {
    // 1 on this dot's place, falling to 0 a whole place away.
    const near = interpolate(Math.abs(position.get() - index), [0, 1], [1, 0], Extrapolation.CLAMP)
    return {
      width: DOT + (ACTIVE - DOT) * near,
      backgroundColor: interpolateColor(near, [0, 1], [colors.dotInactive, colors.brand]),
    }
  })
  return (
    // 24pt wide, 44pt tall with the slop: a fair target without spreading the row out.
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} hitSlop={{ top: 10, bottom: 10 }} style={styles.target}>
      <Animated.View style={[styles.dot, style]} />
    </Pressable>
  )
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', paddingTop: 2 },
  target: { minWidth: ACTIVE + 4, height: 24, alignItems: 'center', justifyContent: 'center' },
  dot: { height: DOT, borderRadius: DOT / 2 },
})

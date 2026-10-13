import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native'
import Animated, { cubicBezier } from 'react-native-reanimated'
import AppText from './AppText'
import { useLang } from '../i18n/LangProvider'
import { webOnly } from '../lib/webStyles'
import { colors } from '../theme'

// Strong ease-out. Native Reanimated CSS only accepts the predefined keywords
// as strings, so a custom curve must be built with cubicBezier().
const EASE_OUT = cubicBezier(0.23, 1, 0.32, 1)

// Equal-width segments with a sliding active pill. The pill is translated by
// whole multiples of its own width (percent translate), so nothing has to be
// measured. `left` and translateX are physical, so in RTL — where the row
// flips — the pill's visual slot is mirrored to match.
export default function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  style,
}: {
  options: readonly { value: T; label: string }[]
  value: T
  onChange: (value: T) => void
  style?: StyleProp<ViewStyle>
}) {
  const { isRtl } = useLang()
  const count = options.length
  const index = Math.max(0, options.findIndex((o) => o.value === value))
  const slot = isRtl ? count - 1 - index : index

  return (
    <View accessibilityRole="tablist" style={[styles.track, style]}>
      <View style={[styles.inner]} pointerEvents="box-none">
        <Animated.View
          pointerEvents="none"
          style={[
            styles.pill,
            {
              width: `${100 / count}%`,
              transform: [{ translateX: `${slot * 100}%` }],
              transitionProperty: 'transform',
              transitionDuration: 220,
              transitionTimingFunction: EASE_OUT,
            },
          ]}
        />
        {options.map((option) => {
          const active = option.value === value
          return (
            <Pressable
              key={option.value}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              onPress={() => onChange(option.value)}
              style={styles.segment}
            >
              <AppText
                style={[
                  styles.label,
                  { color: active ? colors.brand : colors.textMuted },
                ]}
              >
                {option.label}
              </AppText>
            </Pressable>
          )
        })}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  track: { padding: 4, borderRadius: 14, backgroundColor: colors.borderLight },
  inner: { flexDirection: 'row' },
  pill: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    borderRadius: 10,
    backgroundColor: colors.white,
    shadowColor: colors.textStrong,
    shadowOpacity: 0.08,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  segment: {
    flex: 1,
    minHeight: 42,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
    ...webOnly({ cursor: 'pointer', userSelect: 'none' }),
  },
  label: { fontSize: 15, fontWeight: '700', textAlign: 'center' },
})

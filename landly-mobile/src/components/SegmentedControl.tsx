import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native'
import Animated, { cubicBezier } from 'react-native-reanimated'
import AppText from './AppText'
import { useLang } from '../i18n/LangProvider'
import { webOnly } from '../lib/webStyles'
import { colors, radius } from '../theme'

// Strong ease-out. Native Reanimated CSS only accepts the predefined keywords
// as strings, so a custom curve must be built with cubicBezier().
const EASE_OUT = cubicBezier(0.23, 1, 0.32, 1)

// Equal-width segments with a sliding active pill. The pill is translated by
// whole multiples of its own width (percent translate), so nothing has to be
// measured. The pill is anchored at the row's start edge (`start`, which follows
// the root view's direction; a physical `left` is mirrored by iOS under it),
// while translateX is always physical, so in RTL the pill moves the other way. `brand` is the
// member dashboard's look (web: .dash-tabs): a rounded grey track with a
// solid brand pill under white text.
export default function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  style,
  tone = 'surface',
}: {
  options: readonly { value: T; label: string }[]
  value: T
  onChange: (value: T) => void
  style?: StyleProp<ViewStyle>
  tone?: 'surface' | 'brand'
}) {
  const brand = tone === 'brand'
  const { isRtl } = useLang()
  const count = options.length
  const index = Math.max(0, options.findIndex((o) => o.value === value))
  // Physical travel from the start edge: rightwards in English, leftwards in Hebrew.
  const slot = isRtl ? -index : index

  return (
    <View accessibilityRole="tablist" style={[styles.track, brand && styles.brandTrack, style]}>
      <View style={[styles.inner]} pointerEvents="box-none">
        <Animated.View
          pointerEvents="none"
          style={[
            styles.pill,
            brand && styles.brandPill,
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
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.8}
                style={[
                  styles.label,
                  { color: active ? (brand ? colors.white : colors.brand) : brand ? colors.body : colors.textMuted },
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
    start: 0,
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
  brandTrack: { borderRadius: radius.md, borderCurve: 'continuous', backgroundColor: '#eef2f7' },
  brandPill: {
    borderRadius: 10,
    borderCurve: 'continuous',
    backgroundColor: colors.brand,
    shadowColor: colors.brand,
    shadowOpacity: 0.3,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
})

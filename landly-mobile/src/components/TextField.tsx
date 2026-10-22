import { useEffect, useState, type ReactNode, type Ref } from 'react'
import { Platform, Pressable, StyleSheet, TextInput, View, type TextInputProps, type TextStyle } from 'react-native'
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withSequence, withSpring, withTiming } from 'react-native-reanimated'
import Svg, { Path } from 'react-native-svg'
import AppText from './AppText'
import { useLang } from '../i18n/LangProvider'
import { isWeb, webOnly } from '../lib/webStyles'
import { colors } from '../theme'

// Outline icons (Lucide-style 24px paths) shown before the value.
const ICONS = {
  mail: 'M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zM22 7l-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7',
  lock: 'M5 11h14a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2zM7 11V7a5 5 0 0 1 10 0v4',
  user: 'M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
  phone:
    'M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z',
} as const
const EYE = 'M2.06 12.35a1 1 0 0 1 0-.7 10.75 10.75 0 0 1 19.88 0 1 1 0 0 1 0 .7 10.75 10.75 0 0 1-19.88 0zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z'
const EYE_OFF =
  'M10.73 5.08A10.43 10.43 0 0 1 12 5c4.97 0 8.5 4 9.94 6.65a1 1 0 0 1 0 .7 13.16 13.16 0 0 1-1.67 2.68M14.08 14.16a3 3 0 0 1-4.24-4.24M17.48 17.5A10.75 10.75 0 0 1 2.06 12.35a1 1 0 0 1 0-.7 10.38 10.38 0 0 1 4.45-5.13M2 2l20 20'

// Email/password/phone values are typed left-to-right, even in Hebrew; pass
// `natural` for free text such as a name, which follows the language instead.
// A `secureTextEntry` field gets an eye button that shows/hides the value.
// `error` replaces `hint` below the field and turns the border red.
// `prefix` sits inside the field before the value (the phone country code).
// On focus the field box (never the text itself, which would blur) grows to
// FOCUS_SCALE along with the brand border and halo: a spring on native, a
// CSS transition on web. Reduced motion keeps the colour change only.
// `shake` plays a short side-to-side shake each time it goes up while there's
// an error (a submit that failed validation; web: lib/useShake.ts), skipped
// under reduced motion.
const FOCUS_SCALE = 1.025
const FOCUS_SPRING = { damping: 15, stiffness: 120 }

export default function TextField({
  label,
  icon,
  natural,
  hint,
  error,
  onFocus,
  onBlur,
  secureTextEntry,
  prefix,
  shake = 0,
  ...props
}: TextInputProps & {
  label: string
  icon?: keyof typeof ICONS
  natural?: boolean
  hint?: string
  error?: string | null
  prefix?: ReactNode
  shake?: number
  /** Reaches the TextInput through ...props (React 19 passes ref as a prop). */
  ref?: Ref<TextInput>
}) {
  const { t, isRtl } = useLang()
  const rtlText = natural && isRtl
  const [focused, setFocused] = useState(false)
  const [revealed, setRevealed] = useState(false)
  const reduced = useReducedMotion()
  const zoom = focused && !reduced
  const scale = useSharedValue(1)
  const shift = useSharedValue(0)

  useEffect(() => {
    if (!isWeb) scale.set(withSpring(zoom ? FOCUS_SCALE : 1, FOCUS_SPRING))
  }, [zoom, scale])

  useEffect(() => {
    if (!shake || !error || reduced) return
    const step = (x: number) => withTiming(x, { duration: 55 })
    shift.set(withSequence(step(-6), step(6), step(-4), step(4), step(0)))
    // eslint-disable-next-line react-hooks/exhaustive-deps -- plays once per shake
  }, [shake])

  const scaleStyle = useAnimatedStyle(() => ({ transform: [{ translateX: shift.get() }, { scale: scale.get() }] }))
  const shakeStyle = useAnimatedStyle(() => ({ transform: [{ translateX: shift.get() }] }))
  return (
    <View style={styles.wrap}>
      <AppText style={styles.label}>{label}</AppText>
      <Animated.View
        style={[styles.field, focused && styles.fieldFocused, !!error && styles.fieldError, isWeb ? [shakeStyle, zoom && styles.fieldZoomWeb] : scaleStyle]}
      >
        {prefix}
        {icon && (
          <Svg
            width={18}
            height={18}
            viewBox="0 0 24 24"
            fill="none"
            stroke={error ? colors.danger : focused ? colors.brand : colors.textFaint}
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            style={styles.icon}
          >
            <Path d={ICONS[icon]} />
          </Svg>
        )}
        <TextInput
          placeholderTextColor={colors.textFaint}
          {...props}
          aria-invalid={!!error || undefined}
          accessibilityHint={error ?? props.accessibilityHint}
          secureTextEntry={secureTextEntry && !revealed}
          onFocus={(e) => {
            setFocused(true)
            onFocus?.(e)
          }}
          onBlur={(e) => {
            setFocused(false)
            onBlur?.(e)
          }}
          style={[styles.input, { textAlign: rtlText ? 'right' : 'left', writingDirection: rtlText ? 'rtl' : 'ltr' }]}
        />
        {secureTextEntry && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t(revealed ? 'mobile_hidePassword' : 'mobile_showPassword')}
            onPress={() => setRevealed((r) => !r)}
            hitSlop={12}
            style={styles.eye}
          >
            <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={colors.textMuted} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <Path d={revealed ? EYE_OFF : EYE} />
            </Svg>
          </Pressable>
        )}
      </Animated.View>
      {error ? (
        <AppText accessibilityRole="alert" style={styles.error}>{error}</AppText>
      ) : hint ? (
        <AppText style={styles.hint}>{hint}</AppText>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 16 },
  label: { marginBottom: 8, fontSize: 13, fontWeight: '600', color: colors.text },
  field: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    paddingHorizontal: 14,
    backgroundColor: colors.background,
    ...webOnly({
      minHeight: 0,
      height: 52,
      paddingHorizontal: 16,
      cursor: 'text',
      // The zoom is a transform only, so it never moves the layout around it.
      // No will-change: it would pin the box as a bitmap rasterized at 1.0,
      // and the scaled text would stay soft instead of re-rasterizing crisp.
      transitionProperty: 'transform, box-shadow, border-color, background-color',
      transitionDuration: '200ms',
      transitionTimingFunction: 'cubic-bezier(0.16, 1, 0.3, 1), ease, ease, ease',
    }),
  },
  fieldZoomWeb: webOnly({ transform: [{ scale: FOCUS_SCALE }] }),
  // Focus ring: brand border plus a soft brand halo (iOS shadow; Android keeps the border).
  fieldFocused: {
    borderColor: colors.brand,
    backgroundColor: colors.white,
    ...Platform.select({
      web: { boxShadow: '0 0 0 4px rgba(0, 56, 184, 0.12), 0 8px 20px -8px rgba(0, 56, 184, 0.28)' },
      default: { shadowColor: colors.brand, shadowOpacity: 0.18, shadowRadius: 6, shadowOffset: { width: 0, height: 0 } },
    }),
  },
  fieldError: { borderColor: colors.danger },
  error: { marginTop: 6, fontSize: 12, fontWeight: '600', color: colors.danger },
  hint: { marginTop: 6, fontSize: 12, lineHeight: 17, color: colors.textMuted },
  icon: { marginEnd: 10 },
  eye: { marginStart: 8, padding: 2, ...webOnly({ cursor: 'pointer' }) },
  input: {
    flex: 1,
    minHeight: 50,
    fontSize: 16,
    color: colors.textStrong,
    // Web: fill the 52px row; the ring on the container replaces the browser outline.
    // (RN's outlineStyle type has no 'none'; react-native-web passes it through to CSS.)
    ...webOnly({ minHeight: 0, height: '100%', outlineWidth: 0, outlineStyle: 'none' as TextStyle['outlineStyle'] }),
  },
})

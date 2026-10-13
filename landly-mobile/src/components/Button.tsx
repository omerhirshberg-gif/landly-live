import { useState } from 'react'
import { ActivityIndicator, Platform, Pressable, StyleSheet, type ViewStyle } from 'react-native'
import Animated, { cubicBezier } from 'react-native-reanimated'
import Svg, { Path } from 'react-native-svg'
import AppText from './AppText'
import { useLang } from '../i18n/LangProvider'
import { isWeb, webOnly } from '../lib/webStyles'
import { colors, radius } from '../theme'

const PRESS_EASE = cubicBezier(0, 0, 0.58, 1) // ease-out

// Press feedback lands on press-in: a quick scale-down (a Reanimated CSS
// transition, so it runs on the UI thread) plus the darker pressed fill.
export default function Button({
  label,
  onPress,
  disabled,
  busy,
  variant = 'primary',
  large,
  arrow,
}: {
  label: string
  onPress: () => void
  disabled?: boolean
  busy?: boolean
  variant?: 'primary' | 'secondary'
  /** Taller, bolder hero CTA with a soft brand shadow. */
  large?: boolean
  /** Trailing forward arrow; points the reading direction (flips in RTL). */
  arrow?: boolean
}) {
  const { isRtl } = useLang()
  const primary = variant === 'primary'
  const inactive = disabled || busy
  const [pressed, setPressed] = useState(false)
  // Hover only fires with a mouse (web); native never sets it.
  const [hovered, setHovered] = useState(false)
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: inactive, busy }}
      disabled={inactive}
      onPress={onPress}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      onHoverIn={() => setHovered(true)}
      onHoverOut={() => setHovered(false)}
      pressRetentionOffset={16}
      style={inactive ? styles.webNotAllowed : styles.webPointer}
    >
      <Animated.View
        style={[
          styles.base,
          large && styles.large,
          primary ? styles.primary : styles.secondary,
          primary && large && !inactive && styles.primaryShadow,
          hovered && !inactive && (primary ? styles.primaryHovered : styles.secondaryHovered),
          pressed && (primary ? styles.primaryPressed : styles.secondaryPressed),
          inactive && styles.disabled,
          {
            transform: [{ scale: pressed ? 0.97 : 1 }],
            transitionProperty: isWeb ? ['transform', 'backgroundColor'] : 'transform',
            transitionDuration: isWeb ? 150 : 120,
            transitionTimingFunction: PRESS_EASE,
          },
        ]}
      >
        {busy && <ActivityIndicator color={primary ? colors.white : colors.brand} style={styles.spinner} />}
        <AppText style={[styles.label, large && styles.largeLabel, { color: primary ? colors.white : colors.brand }]}>
          {label}
        </AppText>
        {arrow && !busy && (
          <Svg
            width={20}
            height={20}
            viewBox="0 0 24 24"
            fill="none"
            stroke={primary ? colors.white : colors.brand}
            strokeWidth={2.5}
            strokeLinecap="round"
            strokeLinejoin="round"
            style={[styles.arrow, isRtl && styles.flip]}
          >
            <Path d="M5 12h14M12 5l7 7-7 7" />
          </Svg>
        )}
      </Animated.View>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  base: {
    minHeight: 50,
    borderRadius: radius.md,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  large: { minHeight: 54, borderRadius: 14, ...webOnly({ minHeight: 0, height: 52 }) },
  primary: { backgroundColor: colors.brand },
  primaryShadow: Platform.select({
    web: { boxShadow: '0 8px 20px -8px rgba(0, 56, 184, 0.55)' },
    default: {
      shadowColor: colors.brand,
      shadowOpacity: 0.28,
      shadowRadius: 14,
      shadowOffset: { width: 0, height: 6 },
      elevation: 4,
    },
  }),
  primaryHovered: { backgroundColor: colors.brandHover },
  secondaryHovered: { backgroundColor: colors.background },
  webPointer: webOnly({ cursor: 'pointer' }),
  // react-native-web takes any CSS cursor; RN's type only lists auto/pointer.
  webNotAllowed: webOnly({ cursor: 'not-allowed' as ViewStyle['cursor'] }),
  primaryPressed: { backgroundColor: colors.brandDark },
  secondary: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border },
  secondaryPressed: { backgroundColor: colors.brandLight },
  disabled: { opacity: 0.7 },
  spinner: { marginEnd: 8 },
  label: { fontSize: 16, fontWeight: '700', textAlign: 'center' },
  largeLabel: { fontSize: 17, fontWeight: '800', letterSpacing: 0.2 },
  arrow: { marginStart: 10 },
  flip: { transform: [{ scaleX: -1 }] },
})

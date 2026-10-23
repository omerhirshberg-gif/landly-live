import { useState } from 'react'
import { ActivityIndicator, Platform, Pressable, StyleSheet, type ViewStyle } from 'react-native'
import Animated, { cubicBezier } from 'react-native-reanimated'
import Svg, { Path } from 'react-native-svg'
import AppText from './AppText'
import LineIcon, { type LineIconName } from './LineIcon'
import { useLang } from '../i18n/LangProvider'
import { isWeb, webOnly } from '../lib/webStyles'
import { EASE_SILK, ONB } from '@shared/brand/onboardingMotion'
import { colors } from '../theme'

const PRESS_EASE = cubicBezier(...EASE_SILK)

// Press feedback lands on press-in: a gentle scale-down (a Reanimated CSS
// transition on the onboarding's silk curve, so it runs on the UI thread)
// plus the darker pressed fill; a mouse hover (web) lifts it to 1.01.
export default function Button({
  label,
  onPress,
  disabled,
  busy,
  variant = 'primary',
  large,
  arrow,
  icon,
  height,
}: {
  label: string
  onPress: () => void
  disabled?: boolean
  busy?: boolean
  /** danger: the red fill for destructive actions (the account-deletion submit). */
  variant?: 'primary' | 'secondary' | 'danger'
  /** 52px hero CTA with a soft brand shadow; the default is the 48px medium size. */
  large?: boolean
  /** Trailing forward arrow; points the reading direction (flips in RTL). */
  arrow?: boolean
  /** Leading glyph before the label (the lock screen's Face ID / fingerprint). */
  icon?: LineIconName
  /** An exact height instead of the 48/52 sizes (the lock screen's 50px unlock CTA). */
  height?: number
}) {
  const { isRtl } = useLang()
  const primary = variant === 'primary'
  const danger = variant === 'danger'
  // Primary and danger are both solid fills with white text.
  const filled = primary || danger
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
          height != null && { minHeight: 0, height },
          primary ? styles.primary : danger ? styles.danger : styles.secondary,
          primary && large && !inactive && styles.primaryShadow,
          hovered && !inactive && (primary ? styles.primaryHovered : danger ? styles.dangerPressed : styles.secondaryHovered),
          pressed && (primary ? styles.primaryPressed : danger ? styles.dangerPressed : styles.secondaryPressed),
          inactive && styles.disabled,
          {
            transform: [{ scale: pressed ? ONB.pressScale : hovered && !inactive ? ONB.hoverScale : 1 }],
            transitionProperty: isWeb ? ['transform', 'backgroundColor'] : 'transform',
            transitionDuration: ONB.pressMs,
            transitionTimingFunction: PRESS_EASE,
          },
        ]}
      >
        {busy && <ActivityIndicator color={filled ? colors.white : colors.brand} style={styles.spinner} />}
        {icon && !busy && <LineIcon name={icon} size={20} color={filled ? colors.white : colors.brand} style={styles.icon} />}
        <AppText style={[styles.label, large && styles.largeLabel, { color: filled ? colors.white : colors.heading }]}>
          {label}
        </AppText>
        {arrow && !busy && (
          <Svg
            width={20}
            height={20}
            viewBox="0 0 24 24"
            fill="none"
            stroke={filled ? colors.white : colors.brand}
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
  // Design-system sizes (app/globals.css .ds-btn): 48px medium, 52px large, radius 14.
  base: {
    minHeight: 48,
    borderRadius: 14,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  large: { minHeight: 52, ...webOnly({ minHeight: 0, height: 52 }) },
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
  danger: { backgroundColor: colors.danger },
  dangerPressed: { backgroundColor: colors.dangerPressed },
  disabled: { opacity: 0.7 },
  spinner: { marginEnd: 8 },
  icon: { marginEnd: 10 },
  label: { fontSize: 16, fontWeight: '600', textAlign: 'center' },
  largeLabel: { letterSpacing: 0.2 },
  arrow: { marginStart: 10 },
  flip: { transform: [{ scaleX: -1 }] },
})

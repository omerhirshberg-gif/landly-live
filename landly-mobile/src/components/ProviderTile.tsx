import { useState } from 'react'
import { ActivityIndicator, Pressable, StyleSheet, View, type ViewStyle } from 'react-native'
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withSpring } from 'react-native-reanimated'
import Svg, { Circle, Path } from 'react-native-svg'
import type { AuthProvider } from '@shared/auth/appleDevice'
import { soft } from '../lib/haptics'
import { webOnly } from '../lib/webStyles'
import { colors } from '../theme'
import AppText from './AppText'

// A full-width sign-in provider button in the login screen's provider stack:
// as wide as the primary button above it, 52pt tall with the same 14 corners.
// The logo sits on the start edge (the right in Hebrew) inside a 22pt box and
// the label is centred across the whole button. Apple is solid black with a
// white logo; Google and the rest are white with a 1px hairline. Pressing it
// springs it to 0.97 on the UI thread with a soft haptic; while its sign-in
// runs, the logo becomes a spinner of the same size, so the button never
// resizes. Counterpart of the website's components/auth/entrance/ProviderTile.tsx.

// The Apple logo for Sign in with Apple buttons (Apple's guidelines allow it
// logo-only, black, no smaller than the other providers' buttons).
const APPLE_LOGO_PATH =
  'M788.1 340.9c-5.8 4.5-108.2 62.2-108.2 190.5 0 148.4 130.3 200.9 134.2 202.2-.6 3.2-20.7 71.9-68.7 141.9-42.8 61.6-87.5 123.1-155.5 123.1s-85.5-39.5-164-39.5c-76.5 0-103.7 40.8-165.9 40.8s-105.6-57-155.5-127C46.7 790.7 0 663 0 541.8c0-194.4 126.4-297.5 250.8-297.5 66.1 0 121.2 43.4 162.7 43.4 39.5 0 101.1-46 176.3-46 28.5 0 130.9 2.6 198.3 99.2zm-234-181.5c31.1-36.9 53.1-88.1 53.1-139.3 0-7.1-.6-14.3-1.9-20.1-50.6 1.9-110.8 33.7-147.1 75.8-28.5 32.4-55.1 83.6-55.1 135.5 0 7.8 1.3 15.6 1.9 18.1 3.2.6 8.4 1.3 13.6 1.3 45.4 0 102.5-30.4 135.5-71.3z'

/** A provider's logo in its 22pt box; Privacy & Security's sign-in card draws the Apple one black (`appleColor`). */
export function ProviderGlyph({ provider, appleColor = '#FFFFFF' }: { provider: AuthProvider; appleColor?: string }) {
  if (provider === 'apple') {
    return (
      <Svg width={15} height={18} viewBox="0 0 814 1000" style={styles.appleNudge}>
        <Path fill={appleColor} d={APPLE_LOGO_PATH} />
      </Svg>
    )
  }
  if (provider === 'google') {
    return (
      <Svg width={20} height={20} viewBox="0 0 18 18">
        <Path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.9c1.7-1.56 2.7-3.87 2.7-6.62z" />
        <Path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.9-2.26c-.8.54-1.83.86-3.06.86-2.35 0-4.34-1.59-5.05-3.72H.98v2.33A9 9 0 0 0 9 18z" />
        <Path fill="#FBBC05" d="M3.95 10.7A5.4 5.4 0 0 1 3.67 9c0-.59.1-1.17.28-1.7V4.97H.98A9 9 0 0 0 0 9c0 1.45.35 2.83.98 4.03l2.97-2.33z" />
        <Path fill="#EA4335" d="M9 3.58c1.32 0 2.51.46 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .98 4.97l2.97 2.33C4.66 5.17 6.65 3.58 9 3.58z" />
      </Svg>
    )
  }
  // A person and a key, after the FIDO Alliance passkey mark (not offered in the
  // app yet); the viewBox is cropped to 22 units so the stroke draws 1:1.
  return (
    <Svg width={22} height={22} viewBox="1 1 22 22" fill="none" stroke={colors.brand} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Circle cx={9} cy={7} r={4} />
      <Path d="M2 21v-1a6 6 0 0 1 6-6h2.5" />
      <Circle cx={17.5} cy={13.5} r={2.5} />
      <Path d="M17.5 16v5M17.5 18.5h2M17.5 21h1.5" />
    </Svg>
  )
}

// Quick and tight, with no overshoot: a press is a response, not a flourish.
const PRESS_SPRING = { damping: 22, stiffness: 420, mass: 0.6 } as const
const PRESS_SCALE = 0.97

export default function ProviderTile({
  provider,
  label,
  busy = false,
  disabled = false,
  onPress,
}: {
  provider: AuthProvider
  label: string
  busy?: boolean
  disabled?: boolean
  onPress: () => void
}) {
  const [pressed, setPressed] = useState(false)
  const [hovered, setHovered] = useState(false)
  const reduced = useReducedMotion()
  const scale = useSharedValue(1)
  const apple = provider === 'apple'
  const scaleStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }] }))
  const inactive = disabled || busy
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: inactive, busy }}
      disabled={inactive}
      onPress={onPress}
      onPressIn={() => {
        setPressed(true)
        soft()
        scale.set(reduced ? 1 : withSpring(PRESS_SCALE, PRESS_SPRING))
      }}
      onPressOut={() => {
        setPressed(false)
        scale.set(reduced ? 1 : withSpring(1, PRESS_SPRING))
      }}
      onHoverIn={() => setHovered(true)}
      onHoverOut={() => setHovered(false)}
      pressRetentionOffset={16}
      style={[styles.fill, disabled ? styles.webNotAllowed : styles.webPointer]}
    >
      <Animated.View
        style={[
          styles.button,
          apple ? styles.apple : styles.plain,
          (hovered || pressed) && !inactive && (apple ? styles.applePressed : styles.plainPressed),
          // The busy button stays at full strength (its spinner is the feedback); the others dim.
          disabled && !busy && styles.disabled,
          scaleStyle,
        ]}
      >
        <View style={styles.iconBox}>{busy ? <ActivityIndicator size="small" color={apple ? '#FFFFFF' : colors.brand} /> : <ProviderGlyph provider={provider} />}</View>
        <AppText numberOfLines={1} style={[styles.label, { color: apple ? '#FFFFFF' : colors.heading }]}>
          {label}
        </AppText>
      </Animated.View>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  fill: { alignSelf: 'stretch' },
  button: {
    height: 52,
    alignSelf: 'stretch',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    borderWidth: 1,
    // Room for the logo on the start edge so a long label never runs under it.
    paddingHorizontal: 52,
  },
  apple: { backgroundColor: '#000000', borderColor: '#000000' },
  plain: { backgroundColor: colors.white, borderColor: colors.border },
  applePressed: { backgroundColor: '#262626' },
  plainPressed: { backgroundColor: colors.background },
  disabled: { opacity: 0.6 },
  iconBox: { position: 'absolute', start: 18, width: 22, height: 22, alignItems: 'center', justifyContent: 'center' },
  // The primary button's label: 16, bold, slightly tight.
  label: { fontSize: 16, fontWeight: '700', letterSpacing: -0.16, textAlign: 'center' },
  // An offset, not a transform: in the browser build a transform would leave the logo soft.
  appleNudge: { position: 'relative', top: -1 },
  webPointer: webOnly({ cursor: 'pointer' }),
  webNotAllowed: webOnly({ cursor: 'not-allowed' as ViewStyle['cursor'] }),
})

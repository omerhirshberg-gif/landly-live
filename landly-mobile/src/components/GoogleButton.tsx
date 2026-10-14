import { useState } from 'react'
import { Pressable, StyleSheet, View, type ViewStyle } from 'react-native'
import Svg, { Path } from 'react-native-svg'
import AppText from './AppText'
import { webOnly } from '../lib/webStyles'
import { colors } from '../theme'

// Counterpart of the website's components/auth/GoogleButton.tsx, at the
// large secondary button's metrics. Rendered only where Google sign-in is
// available (see auth/googleSignIn.ts).
export default function GoogleButton({ label, onPress, disabled }: { label: string; onPress: () => void; disabled?: boolean }) {
  const [pressed, setPressed] = useState(false)
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      style={disabled ? styles.webNotAllowed : styles.webPointer}
    >
      <View style={[styles.button, pressed && styles.pressed, disabled && styles.disabled]}>
        <Svg width={18} height={18} viewBox="0 0 18 18">
          <Path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.9c1.7-1.56 2.7-3.87 2.7-6.62z" />
          <Path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.9-2.26c-.8.54-1.83.86-3.06.86-2.35 0-4.34-1.59-5.05-3.72H.98v2.33A9 9 0 0 0 9 18z" />
          <Path fill="#FBBC05" d="M3.95 10.7A5.4 5.4 0 0 1 3.67 9c0-.59.1-1.17.28-1.7V4.97H.98A9 9 0 0 0 0 9c0 1.45.35 2.83.98 4.03l2.97-2.33z" />
          <Path fill="#EA4335" d="M9 3.58c1.32 0 2.51.46 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .98 4.97l2.97 2.33C4.66 5.17 6.65 3.58 9 3.58z" />
        </Svg>
        <AppText style={styles.label}>{label}</AppText>
      </View>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  button: {
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingHorizontal: 20,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
    transform: [{ scale: 1 }],
    ...webOnly({ minHeight: 0, height: 52 }),
  },
  pressed: { backgroundColor: colors.background, transform: [{ scale: 0.97 }] },
  disabled: { opacity: 0.6 },
  label: { fontSize: 16, fontWeight: '700', color: colors.text },
  webPointer: webOnly({ cursor: 'pointer' }),
  webNotAllowed: webOnly({ cursor: 'not-allowed' as ViewStyle['cursor'] }),
})

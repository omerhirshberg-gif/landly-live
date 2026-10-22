import { BlurView } from 'expo-blur'
import { Component, type ReactNode } from 'react'
import { Platform, Pressable, StyleSheet, View } from 'react-native'
import LineIcon from './LineIcon'
import { useLang } from '../i18n/LangProvider'
import { webOnly } from '../lib/webStyles'
import { colors, hairline } from '../theme'

const isIos = Platform.OS === 'ios'
const isAndroid = Platform.OS === 'android'

// The back button of every pushed screen (ScreenHeader, the category screen):
// a 42pt circle centred in a 48pt touch target, its chevron on the leading
// side and mirrored in Hebrew.
// - iOS: a floating glass circle, the system chrome material blurring what
//   scrolls under it, a hairline specular rim and a soft ambient shadow.
// - Android: a Material 3 tonal icon button, solid surfaceContainer with the
//   native ripple, no faux blur.
// - Web (Expo export): the same solid circle, darkening while pressed.
export default function GlassBackButton({ onPress, label }: { onPress: () => void; label?: string }) {
  const { t, isRtl } = useLang()

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label ?? t('settings_back')}
      onPress={onPress}
      android_ripple={{ color: colors.border, borderless: true, radius: 24 }}
      style={styles.target}
    >
      {({ pressed }) => (
        <View style={[styles.shadow, pressed && !isAndroid && (isIos ? styles.pressedIos : styles.pressedWeb)]}>
          <View style={styles.surface}>
            {isIos && (
              <GlassFallback>
                <BlurView tint="systemChromeMaterial" intensity={80} style={StyleSheet.absoluteFill} />
              </GlassFallback>
            )}
            <LineIcon name="chevronStart" size={22} color={colors.heading} strokeWidth={2.4} flip={isRtl} />
          </View>
        </View>
      )}
    </Pressable>
  )
}

// If the blur view throws while rendering (a runtime without expo-blur's
// native view), the button keeps a solid, near-opaque circle instead of
// taking the screen down with it.
export class GlassFallback extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  render() {
    return this.state.failed ? <View style={[StyleSheet.absoluteFill, styles.glassFallback]} /> : this.props.children
  }
}

const SIZE = 42

const styles = StyleSheet.create({
  target: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center', ...webOnly({ cursor: 'pointer' }) },
  // Casts the shadow; the surface inside clips the blur to the circle (a
  // clipping view can't cast one on iOS). The faint fill gives the shadow its shape.
  shadow: {
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE / 2,
    ...(isIos && {
      backgroundColor: 'rgba(255, 255, 255, 0.2)',
      shadowColor: colors.textStrong,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.12,
      shadowRadius: 8,
    }),
  },
  surface: {
    flex: 1,
    borderRadius: SIZE / 2,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: isIos ? 'transparent' : colors.surfaceContainer,
    ...(isIos && { borderWidth: hairline, borderColor: 'rgba(255, 255, 255, 0.5)' }),
  },
  glassFallback: { backgroundColor: 'rgba(241, 244, 249, 0.94)' },
  pressedIos: { opacity: 0.6 },
  pressedWeb: { backgroundColor: colors.border },
})

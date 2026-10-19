import { useState } from 'react'
import { Image, PixelRatio, StyleSheet, Text, View } from 'react-native'
import Svg, { Circle, Defs, LinearGradient, Path, Rect, Stop } from 'react-native-svg'
import { sizedAvatarUrl } from '@shared/avatar/avatar'
import { colors } from '../theme'

// The member's photo, else a brand-blue gradient monogram (native counterpart
// of components/ui/Avatar.tsx). A photo that fails to load (an expired Google
// URL) falls back to the monogram. Decorative: the name always sits next to
// it, so it's hidden from screen readers. Google photos are asked for at the
// screen's pixel density, sharp on retina screens.
export default function Avatar({ uri, initials, size = 40 }: { uri: string | null; initials: string; size?: number }) {
  const [failedUri, setFailedUri] = useState<string | null>(null)
  const showPhoto = !!uri && failedUri !== uri
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.base, { width: size, height: size, borderRadius: size / 2 }]}
    >
      {showPhoto ? (
        <Image source={{ uri: sizedAvatarUrl(uri, size * PixelRatio.get()) }} style={StyleSheet.absoluteFill} resizeMode="cover" onError={() => setFailedUri(uri)} />
      ) : (
        <>
          <Svg style={StyleSheet.absoluteFill} viewBox="0 0 100 100" preserveAspectRatio="none">
            <Defs>
              {/* One shared id: every avatar draws the identical gradient, so a clash on web is harmless. */}
              <LinearGradient id="landlyAvatarGradient" x1="0" y1="0" x2="1" y2="1">
                <Stop offset="0" stopColor={colors.brandGradientStart} />
                <Stop offset="0.55" stopColor={colors.brand} />
                <Stop offset="1" stopColor={colors.brandDark} />
              </LinearGradient>
            </Defs>
            <Rect width="100" height="100" fill="url(#landlyAvatarGradient)" />
          </Svg>
          {initials ? (
            <Text
              allowFontScaling={false}
              style={[styles.initials, { fontSize: Math.round(size * (initials.length > 1 ? 0.36 : 0.42)) }]}
            >
              {initials}
            </Text>
          ) : (
            <Svg width={size * 0.5} height={size * 0.5} viewBox="0 0 24 24">
              <Circle cx="12" cy="8" r="4.5" fill={colors.white} fillOpacity={0.9} />
              <Path d="M3.5 22a8.5 8.5 0 0 1 17 0z" fill={colors.white} fillOpacity={0.9} />
            </Svg>
          )}
        </>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  base: { overflow: 'hidden', alignItems: 'center', justifyContent: 'center', backgroundColor: colors.borderLight },
  initials: { color: colors.white, fontWeight: '700', letterSpacing: 0.5, includeFontPadding: false },
})

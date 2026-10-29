import { useState } from 'react'
import { Image, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native'
import { colors } from '../theme'

/** The badge's corner: a smooth rounded square (12–16pt), never a rigid circle that crops a wordmark's ends. */
export function badgeRadius(size: number): number {
  return Math.min(16, Math.max(12, Math.round(size * 0.25)))
}

/** Breathing room around the logo inside the tile: 6pt on a small badge, 8pt from 56pt. */
export function badgePadding(size: number): number {
  return size >= 56 ? 8 : 6
}

// The business on a perk card (DealMedia.tsx) and its page: a white rounded
// tile with a hairline edge holding its logo whole -- square, round or a
// wide wordmark, fitted with room around it -- or, with no logo, or one that
// fails to load, its initial on the brand tint. Floats over the hero's foot
// at the start edge, with a soft drop shadow. `logoUri` is set only once the
// offer's image is known to be a logo (src/lib/imageSource.ts). Uploaded
// logos are trimmed of their transparent margins (lib/images/compressImage.ts),
// so the mark fills the tile. Android scales the full bitmap rather than
// decoding a smaller one (resizeMethod="scale"), which keeps edges crisp.
// Web: components/discover/MerchantBadge.tsx.
export default function MerchantBadge({
  logoUri,
  initial,
  size,
  style,
}: {
  logoUri: string | null
  initial: string
  size: number
  style?: StyleProp<ViewStyle>
}) {
  // Keyed on the URL, so a changed logo gets a fresh attempt.
  const [failedUri, setFailedUri] = useState<string | null>(null)
  const logo = logoUri && failedUri !== logoUri ? logoUri : null
  const borderRadius = badgeRadius(size)
  return (
    <View
      style={[styles.tile, { width: size, height: size, borderRadius }, style]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <View style={[styles.clip, { borderRadius: borderRadius - 1 }, logo ? { padding: badgePadding(size) } : styles.monogram]}>
        {logo ? (
          <Image
            source={{ uri: logo }}
            style={styles.logo}
            resizeMode="contain"
            resizeMethod="scale"
            onError={() => setFailedUri(logo)}
            accessibilityIgnoresInvertColors
          />
        ) : (
          <Text style={[styles.initial, { fontSize: Math.round(size * 0.42) }]} maxFontSizeMultiplier={1} numberOfLines={1}>
            {initial}
          </Text>
        )}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  tile: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.06)',
    shadowColor: colors.textStrong,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.14,
    shadowRadius: 6,
    elevation: 3,
  },
  clip: { flex: 1, overflow: 'hidden', backgroundColor: colors.white },
  logo: { flex: 1, width: '100%' },
  monogram: { alignItems: 'center', justifyContent: 'center', backgroundColor: colors.brandLight },
  initial: { fontWeight: '800', color: colors.brand, textAlign: 'center' },
})

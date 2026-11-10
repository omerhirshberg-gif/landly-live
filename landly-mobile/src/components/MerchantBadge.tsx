import { useState } from 'react'
import { Image, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native'
import { colors } from '../theme'

/** The tile's corner (web: rounded-2xl), side room (web: px-2.5), narrowest width (web: min-w-[56px]) and widest logo (web: max-w-[96px]). */
const BADGE_RADIUS = 16
const BADGE_PADDING = 10
const BADGE_MIN_WIDTH = 56
const LOGO_MAX_WIDTH = 96
/** An offer's own page (web: size="lg"): the tile's side room, narrowest width and widest. */
const LARGE = { padding: 12, minWidth: 72, maxWidth: 160 }

// The business on a perk card (OfferCard.tsx) and its page: a white rounded tile
// with a hairline edge, of one height and as wide as its logo needs: a square or
// round mark sits in the minimum, a wide wordmark grows up to 96pt, or, with no
// logo or one that fails to load, its initial shows. React Native has no intrinsic
// width, so the logo's own proportions come from onLoad. `logoUri` is set only
// once the offer's image is known to be a logo (src/lib/imageSource.ts). Uploaded
// logos are trimmed tight (lib/images/compressImage.ts), so the mark fills the
// tile. Android scales the full bitmap rather than decoding a smaller one
// (resizeMethod="scale"), which keeps edges crisp.
// Web: components/discover/MerchantBadge.tsx.
export default function MerchantBadge({
  logoUri,
  initial,
  height,
  large = false,
  style,
}: {
  logoUri: string | null
  initial: string
  height: number
  /** An offer's own page, where the brand is a headline: a wide wordmark may run to 160pt. */
  large?: boolean
  style?: StyleProp<ViewStyle>
}) {
  // Keyed on the URL, so a changed logo gets a fresh attempt.
  const [failedUri, setFailedUri] = useState<string | null>(null)
  const [loaded, setLoaded] = useState<{ uri: string; aspect: number } | null>(null)
  const logo = logoUri && failedUri !== logoUri ? logoUri : null
  const inner = height - 2
  const logoMaxWidth = large ? LARGE.maxWidth - LARGE.padding * 2 - 2 : LOGO_MAX_WIDTH
  const aspect = loaded && loaded.uri === logo ? loaded.aspect : 1
  return (
    <View
      style={[styles.tile, large && styles.tileLarge, { height }, style]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <View style={[styles.clip, large && styles.clipLarge]}>
        {logo ? (
          <Image
            source={{ uri: logo }}
            style={{ height: inner, width: Math.min(logoMaxWidth, inner * aspect) }}
            resizeMode="contain"
            resizeMethod="scale"
            onLoad={(e) => {
              const { width, height: natural } = e.nativeEvent.source
              if (width && natural) setLoaded({ uri: logo, aspect: width / natural })
            }}
            onError={() => setFailedUri(logo)}
            accessibilityIgnoresInvertColors
          />
        ) : (
          <Text style={[styles.initial, { fontSize: Math.round(height * 0.42) }]} maxFontSizeMultiplier={1} numberOfLines={1}>
            {initial}
          </Text>
        )}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  // Web: border-slate-100, shadow-sm.
  tile: {
    minWidth: BADGE_MIN_WIDTH,
    borderRadius: BADGE_RADIUS,
    // iOS's continuous-curvature corner (a squircle); Android and web draw a plain arc.
    borderCurve: 'continuous',
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.borderLight,
    shadowColor: colors.textStrong,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  // Web: shadow-md.
  tileLarge: { minWidth: LARGE.minWidth, maxWidth: LARGE.maxWidth, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 6, elevation: 4 },
  clipLarge: { paddingHorizontal: LARGE.padding },
  clip: { flex: 1, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', paddingHorizontal: BADGE_PADDING, borderRadius: BADGE_RADIUS - 1, borderCurve: 'continuous', backgroundColor: colors.white },
  initial: { fontWeight: '800', color: colors.brand, textAlign: 'center' },
})

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
/** A feed card's tile (web: h-[44px] min-w-[64px] max-w-[124px] px-1.5 py-1): its height, side room, widest, and the room left for the mark. */
const FIXED = { height: 44, minWidth: 64, maxWidth: 124, paddingX: 6, paddingY: 4, innerHeight: 44 - 2 - 8, maxInnerWidth: 124 - 2 - 12 }

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
  fixed = false,
  style,
}: {
  logoUri: string | null
  initial: string
  height: number
  /** An offer's own page, where the brand is a headline: a wide wordmark may run to 160pt. */
  large?: boolean
  /** A feed card's badge (OfferCard): one 44pt height for every logo, as wide as its logo needs (64-124pt); the mark fills the height. */
  fixed?: boolean
  style?: StyleProp<ViewStyle>
}) {
  // Keyed on the URL, so a changed logo gets a fresh attempt.
  const [failedUri, setFailedUri] = useState<string | null>(null)
  const [loaded, setLoaded] = useState<{ uri: string; aspect: number } | null>(null)
  const logo = logoUri && failedUri !== logoUri ? logoUri : null
  const inner = height - 2
  const logoMaxWidth = large ? LARGE.maxWidth - LARGE.padding * 2 - 2 : LOGO_MAX_WIDTH
  const aspect = loaded && loaded.uri === logo ? loaded.aspect : 1
  if (fixed) {
    // One height for every logo, the width following the mark's proportions inside 64-124pt: a wordmark and a compact
    // mark both fill the height, and a square one is not lost in a wide box. Web: MerchantBadge size="sm".
    return (
      <View style={[styles.fixedTile, style]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        {logo ? (
          <Image
            source={{ uri: logo }}
            style={{ height: FIXED.innerHeight, width: Math.min(FIXED.maxInnerWidth, FIXED.innerHeight * aspect) }}
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
          <Text style={styles.fixedInitial} maxFontSizeMultiplier={1} numberOfLines={1}>
            {initial}
          </Text>
        )}
      </View>
    )
  }
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
  // The feed cards' tile (web: h-[44px] rounded-xl bg-white border border-slate-200/90).
  fixedTile: {
    height: FIXED.height,
    minWidth: FIXED.minWidth,
    maxWidth: FIXED.maxWidth,
    borderRadius: 12,
    borderCurve: 'continuous',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#0B1B3D',
    shadowOpacity: 0.08,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    paddingHorizontal: FIXED.paddingX,
    paddingVertical: FIXED.paddingY,
  },
  fixedInitial: { fontSize: 18, fontWeight: '800', color: colors.brand, textAlign: 'center' },
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

import { useState } from 'react'
import { Image, StyleSheet, View } from 'react-native'
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg'
import { perkImageFit } from '@shared/offers/imageFit'
import AppText from './AppText'
import Emoji from './Emoji'
import { categoryGlyph } from '../lib/categoryGlyphs'
import { businessInitial, secureImageUrl } from '../lib/imageSource'
import { colors, radius } from '../theme'

// An offer's photo, or -- when there is none or it fails to load -- a branded
// panel: a soft brand gradient, the business's initial as a watermark and the
// category's emoji on a white tile. Same design as the website's
// components/discover/PerkImage.tsx. The gradient is drawn with
// react-native-svg (already a dependency) rather than adding a gradient package.
// Fills its parent, which sets the size and corner clipping. A photo covers
// it; a logo (lib/offers/imageFit.ts) sits whole inside with room around it.
// `thumb` scales the fallback's watermark and emoji tile down for a list thumbnail.
export default function PerkImage({
  uri: rawUri,
  category,
  businessName,
  size = 'card',
}: {
  uri: string
  category: string
  businessName: string
  size?: 'card' | 'thumb'
}) {
  const thumb = size === 'thumb'
  const uri = secureImageUrl(rawUri)
  // Keyed on the URL, so a changed image gets a fresh attempt.
  const [failedUri, setFailedUri] = useState<string | null>(null)
  const [measured, setMeasured] = useState<{ uri: string; width: number; height: number } | null>(null)

  if (uri && failedUri !== uri) {
    const fit = perkImageFit(uri, measured?.uri === uri ? measured : null)
    return (
      <Image
        source={{ uri }}
        style={[styles.fill, fit === 'contain' && (thumb ? styles.logoThumb : styles.logo)]}
        resizeMode={fit}
        onError={() => setFailedUri(uri)}
        onLoad={(e) => {
          const { width, height } = e.nativeEvent.source
          setMeasured({ uri, width, height })
        }}
        accessibilityIgnoresInvertColors
      />
    )
  }

  return <CategoryPanel category={category} initial={businessInitial(businessName)} size={size} />
}

/**
 * The branded panel on its own: the gradient, the category's emoji on a
 * white tile and, unless the card already shows the business elsewhere (the
 * perk card's badge), its initial as a watermark. 'hero' is the perk card's
 * full-width picture with no photo (DealMedia.tsx).
 */
export function CategoryPanel({ category, initial, size = 'card' }: { category: string; initial?: string; size?: 'card' | 'thumb' | 'hero' }) {
  const thumb = size === 'thumb'
  const hero = size === 'hero'
  return (
    <View style={[styles.fill, styles.fallback]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Svg style={StyleSheet.absoluteFill} preserveAspectRatio="none">
        <Defs>
          <LinearGradient id="perkFallback" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={colors.brandTint} />
            <Stop offset="0.5" stopColor="#eef2f8" />
            <Stop offset="1" stopColor={colors.border} />
          </LinearGradient>
        </Defs>
        <Rect width="100%" height="100%" fill="url(#perkFallback)" />
      </Svg>
      {!!initial && (
        <AppText ltr style={[styles.initial, thumb && styles.initialThumb]} numberOfLines={1}>
          {initial}
        </AppText>
      )}
      <View style={[styles.tile, thumb && styles.tileThumb, hero && styles.tileHero]}>
        <Emoji glyph={categoryGlyph(category)} size={hero ? 56 : thumb ? 17 : 26} />
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  fill: { width: '100%', height: '100%' },
  // A logo's snug breathing room inside the frame.
  logo: { margin: 8, width: undefined, height: undefined, flex: 1 },
  logoThumb: { margin: 4, width: undefined, height: undefined, flex: 1 },
  fallback: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  initial: {
    position: 'absolute',
    bottom: -22,
    end: 4,
    fontSize: 112,
    lineHeight: 120,
    fontWeight: '900',
    color: 'rgba(0, 56, 184, 0.07)',
  },
  tile: {
    width: 56,
    height: 56,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.92)',
    borderWidth: 1,
    borderColor: colors.border,
  },
  initialThumb: { bottom: -12, fontSize: 60, lineHeight: 64 },
  tileThumb: { width: 34, height: 34, borderRadius: 10 },
  tileHero: { width: 92, height: 92, borderRadius: 26 },
})

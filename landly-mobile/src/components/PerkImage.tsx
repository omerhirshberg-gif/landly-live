import { useState } from 'react'
import { Image, StyleSheet, View } from 'react-native'
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg'
import { CATEGORY_TILES } from '@shared/categories'
import AppText from './AppText'
import { colors, radius } from '../theme'

// An offer's photo, or -- when there is none or it fails to load -- a branded
// panel: a soft brand gradient, the business's initial as a watermark and the
// category's emoji on a white tile. Same design as the website's
// components/discover/PerkImage.tsx. The gradient is drawn with
// react-native-svg (already a dependency) rather than adding a gradient package.
// Fills its parent, which sets the size and corner clipping.
// `thumb` scales the fallback's watermark and emoji tile down for a list thumbnail.
export default function PerkImage({
  uri,
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
  // Keyed on the URL, so a changed image gets a fresh attempt.
  const [failedUri, setFailedUri] = useState<string | null>(null)

  if (uri && failedUri !== uri) {
    return (
      <Image
        source={{ uri }}
        style={styles.fill}
        resizeMode="cover"
        onError={() => setFailedUri(uri)}
        accessibilityIgnoresInvertColors
      />
    )
  }

  const emoji = CATEGORY_TILES.find((c) => c.category === category)?.emoji ?? '🎁'
  const initial = Array.from(businessName.trim())[0]?.toUpperCase() ?? ''

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
      <View style={[styles.tile, thumb && styles.tileThumb]}>
        <AppText style={[styles.emoji, thumb && styles.emojiThumb]}>{emoji}</AppText>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  fill: { width: '100%', height: '100%' },
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
  emoji: { fontSize: 26, lineHeight: 32 },
  initialThumb: { bottom: -12, fontSize: 60, lineHeight: 64 },
  tileThumb: { width: 34, height: 34, borderRadius: 10 },
  emojiThumb: { fontSize: 17, lineHeight: 22 },
})

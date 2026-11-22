import { StyleSheet, View } from 'react-native'
import Image, { type SafeImageSource } from './SafeImage'

// A brand's picture filling its whole frame, edge to edge, never a logo on a white box (web: components/ui/BrandMedia.tsx).
// A venue photo (`cover`) is stretched across all four edges. A logo or mark, which can't be stretched without clipping, is
// stacked in three layers: 0 a blurred copy of itself covering the frame, 1 a soft tint over it, 2 the crisp logo, whole, centred.
// The blurred copy is drawn at an eighth of the frame and scaled up about its centre (the same trick as DealMedia's backdrop):
// the bitmap decodes at the small size, so the blur is cheap and the frame's size is never needed.
const BACKDROP_SCALE = 8

export default function BrandMedia({
  source,
  cover = false,
  inset = 10,
  recyclingKey,
  onError,
}: {
  source: SafeImageSource
  /** A photograph: fills the frame, no backdrop. */
  cover?: boolean
  /** Air around a whole logo, in points. */
  inset?: number
  recyclingKey?: string | null
  onError?: () => void
}) {
  if (cover) {
    return <Image source={source} style={StyleSheet.absoluteFill} contentFit="cover" cachePolicy="memory-disk" recyclingKey={recyclingKey} onError={onError} accessible={false} accessibilityIgnoresInvertColors />
  }
  return (
    <View style={StyleSheet.absoluteFill}>
      <View pointerEvents="none" style={styles.backdrop} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <Image source={source} style={styles.backdropSmall} contentFit="cover" cachePolicy="memory-disk" recyclingKey={recyclingKey} blurRadius={24 / BACKDROP_SCALE} accessible={false} accessibilityIgnoresInvertColors />
      </View>
      <View pointerEvents="none" style={styles.scrim} />
      <View style={[styles.logo, { padding: inset }]}>
        <Image source={source} style={styles.logoImage} contentFit="contain" cachePolicy="memory-disk" recyclingKey={recyclingKey} onError={onError} accessible={false} accessibilityIgnoresInvertColors />
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  // Layer 0: the blurred copy.
  backdrop: { ...StyleSheet.absoluteFill, zIndex: 0, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', backgroundColor: '#EEF2F7' },
  // A faint wash (15%), so a white-ground logo never leaves giant blurred letters behind it.
  backdropSmall: { width: '12.5%', height: '12.5%', opacity: 0.15, transform: [{ scale: BACKDROP_SCALE }] },
  // Layer 1: a soft studio tint, so a dark or saturated logo never turns the frame muddy.
  scrim: { ...StyleSheet.absoluteFill, zIndex: 1, backgroundColor: 'rgba(244, 246, 249, 0.55)' },
  // Layer 2: the crisp logo.
  logo: { ...StyleSheet.absoluteFill, zIndex: 2 },
  logoImage: { width: '100%', height: '100%' },
})

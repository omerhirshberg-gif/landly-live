import { useState, type ReactNode } from 'react'
import { Image, StyleSheet, View } from 'react-native'
import Animated from 'react-native-reanimated'
import { dealPhotoFit } from '@shared/offers/imageFit'
import { CategoryPanel } from './PerkImage'
import { radius } from '../theme'
import type { DealImage } from '../lib/useDealImage'

// A perk card's picture (OfferCard.tsx; src/lib/imageSource.ts): a photo of the
// deal fills the hero. Without a photo the hero shows the category's panel.
// Until a bitmap has loaded (its kind may hang on its size) the hero shows the
// panel, then the photo fades in over it (src/lib/useDealImage.ts); no link, or
// one that fails, keeps the panel. Nothing tints the picture: the overlays
// (`children`: the category pill, the discount, the heart) carry their own solid
// backgrounds. The card holds the image's state, as its logo box needs the role too.
//
// A landscape photo (ratio 1.2 or more) fills the frame (cover). A square or
// portrait one is shown whole (contain) in front of a soft blurred copy of itself,
// so its head and feet are never cut off; the offer screen also lets the frame
// follow it (containRatio, up to containMaxHeight). Web: components/discover/DealMedia.tsx.
export default function DealMedia({
  image,
  category,
  corners = 'card',
  ratio = 16 / 9,
  maxHeight,
  containRatio,
  containMaxHeight,
  children,
}: {
  image: DealImage
  category: string
  /** 'card': the card's top corners. 'all': all four, for a picture that doesn't sit at the top of a card. 'none': square, for one running edge to edge. */
  corners?: 'card' | 'all' | 'none'
  /** The frame's width-to-height ratio: 16:9 on the offer screen, 2:1 on the feed cards. */
  ratio?: number
  /** Caps the frame's height (the feed cards' 172pt), cropping the photo's sides a little more on a wide screen. */
  maxHeight?: number
  /** For a square or portrait photo shown whole: the frame's shape instead of `ratio` (the offer screen's taller hero). */
  containRatio?: number
  /** And its height cap instead of `maxHeight`. */
  containMaxHeight?: number
  children?: ReactNode
}) {
  const { uri, role, size, photoStyle, onLoad, onError } = image
  const whole = role === 'photo' && dealPhotoFit(size) === 'contain'
  const frameRatio = whole && containRatio ? containRatio : ratio
  const frameMax = whole && containRatio ? containMaxHeight : maxHeight
  // Sized from the measured width (ratio, then the height cap) rather than leaving Yoga to resolve an aspect ratio under a maxHeight, which can narrow the frame and leave white beside the photo.
  const [width, setWidth] = useState(0)
  const height = width > 0 ? Math.min(width / frameRatio, frameMax ?? Infinity) : undefined

  return (
    <View
      style={[styles.frame, height != null ? { height } : { aspectRatio: frameRatio }]}
      onLayout={(e) => {
        const next = Math.round(e.nativeEvent.layout.width)
        if (next !== width) setWidth(next)
      }}
    >
      <View style={[styles.hero, corners === 'all' && styles.heroRounded, corners === 'none' && styles.heroSquare]}>
        <CategoryPanel category={category} size="hero" />
        {/* Loaded while still unknown, so its size can tell a photo from a logo. */}
        {(role === 'pending' || role === 'photo') && (
          <Animated.View style={[StyleSheet.absoluteFill, photoStyle]}>
            {/* Three layers, each absolutely filling the frame and stacked by zIndex: 0 the blurred copy, 1 the studio tint, 2 the crisp photo (never blurred). In normal flow the blurred copy took the whole frame and pushed the photo out of it. */}
            {whole && <Image source={{ uri }} style={styles.backdrop} resizeMode="cover" blurRadius={24} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" accessibilityIgnoresInvertColors />}
            {whole && <View pointerEvents="none" style={styles.studio} />}
            <Image source={{ uri }} style={styles.photo} resizeMode={whole ? 'contain' : 'cover'} resizeMethod="scale" onError={onError} onLoad={onLoad} accessibilityIgnoresInvertColors />
          </Animated.View>
        )}
      </View>
      {/* The overlays (pills, heart, merchant badge) sit above the photo's layers. box-none: only the overlays themselves take touches. */}
      <View pointerEvents="box-none" style={styles.overlays}>
        {children}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  // Not clipped, so the overlays' shadows are drawn.
  // Full width whatever the height cap: an aspect ratio under a maxHeight would otherwise narrow the frame and leave white at its sides.
  frame: { zIndex: 1, width: '100%', alignSelf: 'stretch' },
  // Clipped to the card's top corners (its 16pt radius inside the 1pt border).
  hero: { flex: 1, overflow: 'hidden', borderTopStartRadius: 15, borderTopEndRadius: 15 },
  heroRounded: { borderRadius: radius.lg },
  heroSquare: { borderTopStartRadius: 0, borderTopEndRadius: 0 },
  // Layer 0: the blurred copy of a whole photo (web: z-0).
  backdrop: { ...StyleSheet.absoluteFill, zIndex: 0 },
  // Layer 1: a soft studio tint over it (web: z-[1] bg-[#F4F6F9]/50).
  studio: { ...StyleSheet.absoluteFill, zIndex: 1, backgroundColor: 'rgba(244, 246, 249, 0.45)' },
  // Layer 2: the crisp photo, no blurRadius (web: z-[2]).
  photo: { ...StyleSheet.absoluteFill, width: '100%', height: '100%', zIndex: 2 },
  // Layer 3: the overlays (web: later siblings of the photo).
  overlays: { ...StyleSheet.absoluteFill, zIndex: 10 },
})

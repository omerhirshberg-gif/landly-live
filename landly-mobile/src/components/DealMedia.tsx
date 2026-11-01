import type { ReactNode } from 'react'
import { Image, StyleSheet, View } from 'react-native'
import Animated from 'react-native-reanimated'
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
export default function DealMedia({
  image,
  category,
  corners = 'card',
  children,
}: {
  image: DealImage
  category: string
  /** 'card': the card's top corners. 'all': all four, for a picture that doesn't sit at the top of a card. 'none': square, for one running edge to edge. */
  corners?: 'card' | 'all' | 'none'
  children?: ReactNode
}) {
  const { uri, role, photoStyle, onLoad, onError } = image

  return (
    <View style={styles.frame}>
      <View style={[styles.hero, corners === 'all' && styles.heroRounded, corners === 'none' && styles.heroSquare]}>
        <CategoryPanel category={category} size="hero" />
        {/* Loaded while still unknown, so its size can tell a photo from a logo. */}
        {(role === 'pending' || role === 'photo') && (
          <Animated.View style={[StyleSheet.absoluteFill, photoStyle]}>
            <Image source={{ uri }} style={styles.fill} resizeMode="cover" resizeMethod="scale" onError={onError} onLoad={onLoad} accessibilityIgnoresInvertColors />
          </Animated.View>
        )}
      </View>
      {children}
    </View>
  )
}

const styles = StyleSheet.create({
  // Not clipped, so the overlays' shadows are drawn.
  frame: { aspectRatio: 16 / 9, zIndex: 1 },
  // Clipped to the card's top corners (its 16pt radius inside the 1pt border).
  hero: { flex: 1, overflow: 'hidden', borderTopStartRadius: 15, borderTopEndRadius: 15 },
  heroRounded: { borderRadius: radius.lg },
  heroSquare: { borderTopStartRadius: 0, borderTopEndRadius: 0 },
  fill: { width: '100%', height: '100%' },
})

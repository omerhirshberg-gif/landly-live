import type { ReactNode } from 'react'
import { Image, StyleSheet, View } from 'react-native'
import Animated from 'react-native-reanimated'
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg'
import MerchantBadge from './MerchantBadge'
import { CategoryPanel } from './PerkImage'
import { badgeLogoUri, businessInitial, secureImageUrl } from '../lib/imageSource'
import { useDealImage } from '../lib/useDealImage'

export type DealMediaSize = 'standard' | 'compact'

/** The merchant badge's side (a rounded square), and how far it sits in from the card's start edge. */
export const DEAL_BADGE: Record<DealMediaSize, number> = { standard: 56, compact: 48 }
export const DEAL_BADGE_INSET: Record<DealMediaSize, number> = { standard: 12, compact: 10 }

// A perk card's picture (OfferCard.tsx), two images (src/lib/imageSource.ts):
// a photo of the deal fills the hero, and the business's logo sits in the
// badge. Without a photo the hero shows the category's panel; without a
// logo the badge shows one found in the offer's image, else the business's
// initial. Until a bitmap has loaded (its kind may hang on its size) the
// hero shows the panel, then the photo fades in over it (src/lib/useDealImage.ts);
// no link, or one that fails, keeps the panel. A dark scrim at the foot gives the white
// overlays (`children`: the category pill, the discount, the heart) their
// contrast. The badge overlaps the hero's foot by half at the start edge, so
// it mirrors in Hebrew; the card leaves room for it beside the business name.
export default function DealMedia({
  uri: rawUri,
  logoUri: rawLogoUri,
  category,
  businessName,
  size,
  children,
}: {
  uri: string
  /** The business's logo (offer.businessLogoUrl); '' = none. */
  logoUri: string
  category: string
  businessName: string
  size: DealMediaSize
  children?: ReactNode
}) {
  const { uri, role, photoStyle, onLoad, onError } = useDealImage(rawUri)
  const businessLogo = secureImageUrl(rawLogoUri)

  const badge = DEAL_BADGE[size]
  const inset = DEAL_BADGE_INSET[size]

  return (
    <View style={styles.frame}>
      <View style={styles.hero}>
        <CategoryPanel category={category} size="hero" />
        {/* Loaded while still unknown, so its size can tell a photo from a logo. */}
        {(role === 'pending' || role === 'photo') && (
          <Animated.View style={[StyleSheet.absoluteFill, photoStyle]}>
            <Image source={{ uri }} style={styles.fill} resizeMode="cover" resizeMethod="scale" onError={onError} onLoad={onLoad} accessibilityIgnoresInvertColors />
          </Animated.View>
        )}
        <View pointerEvents="none" style={styles.scrim}>
          <Svg style={StyleSheet.absoluteFill} preserveAspectRatio="none">
            <Defs>
              <LinearGradient id="dealScrim" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor="#000000" stopOpacity={0} />
                <Stop offset="1" stopColor="#000000" stopOpacity={0.32} />
              </LinearGradient>
            </Defs>
            <Rect width="100%" height="100%" fill="url(#dealScrim)" />
          </Svg>
        </View>
      </View>
      {children}
      <MerchantBadge
        logoUri={badgeLogoUri(businessLogo, uri, role)}
        initial={businessInitial(businessName)}
        size={badge}
        style={[styles.badge, { start: inset, bottom: -badge / 2 }]}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  // Not clipped, so the badge can hang over the hero's foot.
  frame: { aspectRatio: 16 / 10, zIndex: 1 },
  // Clipped to the card's top corners (its 16pt radius inside the 1pt border).
  hero: { flex: 1, overflow: 'hidden', borderTopStartRadius: 15, borderTopEndRadius: 15 },
  fill: { width: '100%', height: '100%' },
  scrim: { position: 'absolute', start: 0, end: 0, bottom: 0, height: '45%' },
  badge: { position: 'absolute' },
})

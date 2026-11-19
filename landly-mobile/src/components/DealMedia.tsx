import { useState, type ReactNode } from 'react'
import { StyleSheet, View, type ImageSourcePropType } from 'react-native'
import Image from './SafeImage'
import Animated from 'react-native-reanimated'
import { dealPhotoFit } from '@shared/offers/imageFit'
import { CategoryPanel } from './PerkImage'
import { radius } from '../theme'
import type { DealImage } from '../lib/useDealImage'

// eslint-disable-next-line @typescript-eslint/no-require-imports
const FALLBACK_LOGO = require('../../assets/images/raayonit-logo.png') as ImageSourcePropType

// A perk card's picture (OfferCard.tsx; src/lib/imageSource.ts): a photo of the
// deal fills the hero. Without a photo the hero shows the category's panel.
// Until a bitmap has loaded (its kind may hang on its size) the hero shows the
// panel, then the photo fades in over it (src/lib/useDealImage.ts); no link, or
// one that fails, keeps the panel. Nothing tints the picture: the overlays
// (`children`: the category pill, the discount, the heart) carry their own solid
// backgrounds. The card holds the image's state, as its logo box needs the role too.
//
// A Raayonit card (image.ambient) uses a wider rule: only a 1.35-1.85 landscape fills the frame, every other shape sits whole with 16pt of air over the blurred copy (lib/offers/imageFit.ts).
// A landscape photo (ratio 1.2 or more) fills the frame (cover). A square or
// portrait one is shown whole (contain) in front of a soft blurred copy of itself,
// so its head and feet are never cut off; the offer screen also lets the frame
// follow it (containRatio, up to containMaxHeight). Web: components/discover/DealMedia.tsx.
//
// Pictures go through SafeImage (expo-image when the binary has it): kept in memory and on disk, so a card that
// scrolls back or a screen opened again draws at once, and a recycled list cell
// (`recyclingKey`) never flashes the previous card's photo. The blurred copy
// behind a whole photo is drawn at an eighth of the frame and scaled up: the
// bitmap is decoded at that small size, so the blur costs about 1/64 of a
// full-size one and looks the same. It is centred by flexbox and scaled about
// its centre, so no side is involved and Hebrew needs nothing of its own.
const BACKDROP_SCALE = 8

export default function DealMedia({
  image,
  category,
  corners = 'card',
  ratio = 16 / 9,
  maxHeight,
  containRatio,
  containMaxHeight,
  logo,
  logoSmall = false,
  width: fixedWidth,
  recyclingKey,
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
  /** A logo-only perk (lib/logoHero.ts): the logo is the hero, large on white (web: DealMedia's `logo`). */
  logo?: ImageSourcePropType | null
  /** The Raayonit mark standing in for a brand with no picture: drawn small and centred. */
  logoSmall?: boolean
  /** The frame's width when the caller knows it (a carousel slot, a feed cell): sized on the first pass, with no layout round trip. */
  width?: number
  /** The perk's id, so a recycled list cell drops the previous card's picture at once. */
  recyclingKey?: string
  children?: ReactNode
}) {
  const { source, role, size, ambient, graphic, photoStyle, onLoad, onError } = image
  // A logo that fails to load (or is gone) is replaced by the Raayonit mark, never a broken or empty box.
  // Keyed on the card, so a recycled list cell showing another perk tries that perk's logo afresh.
  const logoKey = recyclingKey ?? (logo && typeof logo === 'object' && !Array.isArray(logo) && 'uri' in logo ? logo.uri : logo) ?? null
  const [failedLogoKey, setFailedLogoKey] = useState<unknown>(undefined)
  const logoFailed = failedLogoKey !== undefined && failedLogoKey === logoKey
  const whole = role === 'photo' && dealPhotoFit(size, { ambient, graphic }) === 'contain'
  // The taller offer-screen frame is for a portrait shot; a Raayonit brand graphic that is merely square or wide keeps the card's own frame.
  const tall = whole && !!containRatio && (!ambient || (size != null && size.width < size.height))
  const frameRatio = tall ? containRatio! : ratio
  const frameMax = tall ? containMaxHeight : maxHeight
  // A Raayonit graphic gets optical breathing room (16pt) so its edges never touch the frame.
  const inset = whole && ambient
  // Sized from the measured width (ratio, then the height cap) rather than leaving Yoga to resolve an aspect ratio under a maxHeight, which can narrow the frame and leave white beside the photo.
  const [measuredWidth, setMeasuredWidth] = useState(0)
  const width = fixedWidth && fixedWidth > 0 ? Math.round(fixedWidth) : measuredWidth
  const height = width > 0 ? Math.min(width / frameRatio, frameMax ?? Infinity) : undefined

  return (
    <View
      style={[styles.frame, height != null ? { height } : { aspectRatio: frameRatio }]}
      onLayout={
        fixedWidth
          ? undefined
          : (e) => {
              const next = Math.round(e.nativeEvent.layout.width)
              if (next !== measuredWidth) setMeasuredWidth(next)
            }
      }
    >
      <View style={[styles.hero, corners === 'all' && styles.heroRounded, corners === 'none' && styles.heroSquare]}>
        {logo ? (
          <View style={[styles.logoHero, (logoSmall || logoFailed) && styles.logoHeroSmall]}>
            <Image source={logoFailed ? FALLBACK_LOGO : logo} style={styles.logoImage} contentFit="contain" cachePolicy="memory-disk" recyclingKey={recyclingKey} transition={150} onError={() => setFailedLogoKey(logoKey)} accessibilityIgnoresInvertColors />
          </View>
        ) : <CategoryPanel category={category} size="hero" />}
        {/* Loaded while still unknown, so its size can tell a photo from a logo. */}
        {!logo && source && (role === 'pending' || role === 'photo') && (
          <Animated.View style={[StyleSheet.absoluteFill, photoStyle]}>
            {/* Three layers, each absolutely filling the frame and stacked by zIndex: 0 the blurred copy, 1 the studio tint, 2 the crisp photo (never blurred). In normal flow the blurred copy took the whole frame and pushed the photo out of it. */}
            {whole && <View pointerEvents="none" style={styles.base} />}
            {whole && width > 0 && height != null && (
              <View pointerEvents="none" style={styles.backdrop} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
                <Image
                  source={source}
                  style={[styles.backdropSmall, { width: Math.ceil(width / BACKDROP_SCALE) + 1, height: Math.ceil(height / BACKDROP_SCALE) + 1 }]}
                  contentFit="cover"
                  cachePolicy="memory-disk"
                  recyclingKey={recyclingKey}
                  blurRadius={24 / BACKDROP_SCALE}
                  accessibilityIgnoresInvertColors
                />
              </View>
            )}
            {whole && <View pointerEvents="none" style={styles.studio} />}
            <View style={[styles.photo, inset && styles.photoInset]}>
              <Image
                source={source}
                style={styles.photoImage}
                contentFit={whole ? 'contain' : 'cover'}
                cachePolicy="memory-disk"
                recyclingKey={recyclingKey}
                transition={150}
                onError={onError}
                onLoad={onLoad}
                accessibilityIgnoresInvertColors
              />
            </View>
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
  logoHero: { ...StyleSheet.absoluteFill, backgroundColor: '#FFFFFF', paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#E2E8F0' },
  // The Raayonit mark standing in for a brand with no picture: small and centred over a soft slate/ice studio surface, never stark white.
  logoHeroSmall: { paddingHorizontal: '28%', paddingVertical: '12%', backgroundColor: '#E9EEF4', experimental_backgroundImage: 'linear-gradient(135deg, #F1F5F9, #E2E8F0)' },
  logoImage: { width: '100%', height: '100%' },
  // Under layer 0: an opaque studio base, so a transparent logo never shows the category panel's icon through it (web: the bg-[#F4F6F9] div).
  base: { ...StyleSheet.absoluteFill, backgroundColor: '#F4F6F9' },
  // Layer 0: the blurred copy of a whole photo (web: z-0), an eighth of the frame, centred and scaled up about its centre.
  backdrop: { ...StyleSheet.absoluteFill, zIndex: 0, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  backdropSmall: { transform: [{ scale: BACKDROP_SCALE }] },
  // Layer 1: a soft studio tint over it (web: z-[1] bg-[#F4F6F9]/50).
  studio: { ...StyleSheet.absoluteFill, zIndex: 1, backgroundColor: 'rgba(244, 246, 249, 0.45)' },
  // Layer 2: the crisp photo, no blurRadius (web: z-[2]).
  photo: { ...StyleSheet.absoluteFill, width: '100%', height: '100%', zIndex: 2 },
  // A Raayonit graphic shown whole: 16pt of air all round (web: p-4).
  photoInset: { padding: 16 },
  photoImage: { width: '100%', height: '100%' },
  // Layer 3: the overlays (web: later siblings of the photo).
  overlays: { ...StyleSheet.absoluteFill, zIndex: 10 },
})

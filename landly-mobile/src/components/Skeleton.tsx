import { createContext, useContext, useEffect, type ReactNode } from 'react'
import { StyleSheet, View, type DimensionValue, type StyleProp, type ViewStyle } from 'react-native'
import Animated, { cancelAnimation, Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withTiming, type SharedValue } from 'react-native-reanimated'
import { useLang } from '../i18n/LangProvider'
import { carouselCardWidth, CAROUSEL_GAP } from '../lib/carousel'
import { useLayout } from '../lib/useLayout'
import { colors, radius } from '../theme'

// Loading placeholders in the exact shape of what's coming, so nothing jumps
// when it arrives (web: components/ui/Skeleton.tsx): soft slate blocks inside
// the real card frames. One pulse drives every block of a placeholder, so
// they breathe together; Reduce Motion holds them still. Each placeholder is
// one "Loading…" to a screen reader.
const Pulse = createContext<SharedValue<number> | null>(null)

function Loading({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const { t } = useLang()
  const reduced = useReducedMotion()
  const pulse = useSharedValue(1)
  useEffect(() => {
    if (reduced) return
    pulse.set(withRepeat(withTiming(0.5, { duration: 900, easing: Easing.inOut(Easing.ease) }), -1, true))
    return () => cancelAnimation(pulse)
  }, [pulse, reduced])
  return (
    <View accessible accessibilityRole="progressbar" accessibilityLabel={t('bizdash_loading')} style={style}>
      <Pulse.Provider value={pulse}>{children}</Pulse.Provider>
    </View>
  )
}

function Bone({ width = '100%', height, style }: { width?: DimensionValue; height?: number; style?: StyleProp<ViewStyle> }) {
  const pulse = useContext(Pulse)
  const fade = useAnimatedStyle(() => ({ opacity: pulse ? pulse.get() : 1 }))
  return <Animated.View style={[styles.bone, { width, height }, fade, style]} />
}

// OfferCard: the 16:9 framed picture, the business, two title lines, the price row.
function OfferCardSkeleton({ style }: { style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[styles.card, style]}>
      <Bone style={styles.media} />
      <View style={styles.body}>
        <Bone width="45%" height={16} />
        <Bone width="92%" height={13} style={styles.gap8} />
        <Bone width="60%" height={13} style={styles.gap6} />
        <View style={styles.priceRow}>
          <Bone width={88} height={20} />
          <Bone width={48} height={16} />
        </View>
      </View>
    </View>
  )
}

/** A perk list loading (Perks, a category, the Wishlist): full-width OfferCard placeholders. */
export function OfferListSkeleton({ count = 3 }: { count?: number }) {
  return (
    <Loading>
      {Array.from({ length: count }, (_, i) => <OfferCardSkeleton key={i} />)}
    </Loading>
  )
}

/** Home's Curated for you loading: the carousel's cards, the next one peeking in. */
export function OfferCarouselSkeleton() {
  const { width, paddingRight } = useLayout()
  const cardWidth = carouselCardWidth(width)
  return (
    <Loading style={[styles.carousel, { marginRight: -paddingRight }]}>
      <OfferCardSkeleton style={[styles.carouselCard, { width: cardWidth }]} />
      <OfferCardSkeleton style={[styles.carouselCard, { width: cardWidth }]} />
    </Loading>
  )
}

/** The Wallet loading: VoucherPass placeholders (thumbnail, business, title, the method chip). */
export function PassListSkeleton({ count = 3 }: { count?: number }) {
  return (
    <Loading>
      {Array.from({ length: count }, (_, i) => (
        <View key={i} style={[styles.card, styles.pass]}>
          <Bone width={64} height={64} style={styles.thumb} />
          <View style={styles.passText}>
            <Bone width="55%" height={16} />
            <Bone width="85%" height={13} style={styles.gap8} />
            <Bone width={96} height={20} style={[styles.gap10, styles.chip]} />
          </View>
        </View>
      ))}
    </Loading>
  )
}

const styles = StyleSheet.create({
  bone: { backgroundColor: colors.borderLight, borderRadius: 8 },
  // The same frame as OfferCard and VoucherPass: white, hairline border, 16pt corners.
  card: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 12,
  },
  media: { marginHorizontal: 8, marginTop: 8, width: 'auto', aspectRatio: 16 / 9, borderRadius: radius.frame },
  body: { paddingHorizontal: 12, paddingTop: 10, paddingBottom: 12 },
  priceRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 14 },
  carousel: { flexDirection: 'row', overflow: 'hidden' },
  carouselCard: { marginBottom: 0, marginEnd: CAROUSEL_GAP },
  pass: { flexDirection: 'row', alignItems: 'center', padding: 16 },
  thumb: { borderRadius: radius.md },
  passText: { flex: 1, marginStart: 12 },
  chip: { borderRadius: radius.pill },
  gap6: { marginTop: 6 },
  gap8: { marginTop: 8 },
  gap10: { marginTop: 10 },
})

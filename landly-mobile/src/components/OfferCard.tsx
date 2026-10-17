import { Image, Pressable, StyleSheet, View } from 'react-native'
import Svg, { Path } from 'react-native-svg'
import { CATEGORY_TILES } from '@shared/categories'
import { getOfferDiscountPercent, type OfferDocument } from '@shared/firebase/offers'
import { formatPrice } from '@shared/format'
import { useWishlist } from '@shared/firebase/useWishlist'
import AppText from './AppText'
import LineIcon from './LineIcon'
import { useLang } from '../i18n/LangProvider'
import { webOnly } from '../lib/webStyles'
import { colors, radius } from '../theme'

// A perk: photo with its category badge (top start) and "{n}% OFF" banner
// (top end), then merchant, title, location, price and a "View deal" line.
// The whole card is the button; the CTA line only says what tapping does.
// The heart at the photo's bottom end corner saves or un-saves the perk in
// the member's wishlist, shared live with the website (web: the heart at
// its top end, where this card has the discount banner).
// Same anatomy as the website's components/discover/OfferCard.tsx.
export default function OfferCard({ offer, onPress }: { offer: OfferDocument; onPress: () => void }) {
  const { t, isRtl } = useLang()
  const discount = getOfferDiscountPercent(offer.originalPrice, offer.offerPrice)
  const tile = CATEGORY_TILES.find((c) => c.category === offer.category)
  const { isWishlisted, toggleWishlist } = useWishlist()
  const saved = isWishlisted(offer.id)
  const wishlistLabel = saved ? t('btn_remove_from_wishlist') : t('btn_add_to_wishlist')
  return (
    <Pressable
      accessibilityRole="button"
      // The card is one element to a screen reader, which can't reach the
      // heart inside it, so saving is also offered as an action on the card.
      accessibilityActions={[{ name: 'wishlist', label: wishlistLabel }]}
      onAccessibilityAction={(e) => {
        if (e.nativeEvent.actionName === 'wishlist') toggleWishlist(offer.id)
      }}
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      <View>
        {offer.imageUrl ? (
          <Image source={{ uri: offer.imageUrl }} style={styles.image} resizeMode="cover" accessibilityIgnoresInvertColors />
        ) : (
          <View style={[styles.image, styles.imagePlaceholder]} />
        )}
        {tile && (
          <View style={[styles.overlay, styles.overlayStart, styles.category]}>
            <AppText style={styles.categoryText} numberOfLines={1}>
              {`${tile.emoji} ${t(tile.labelKey)}`}
            </AppText>
          </View>
        )}
        {discount > 0 && (
          <View style={[styles.overlay, styles.overlayEnd, styles.banner]}>
            <AppText style={styles.bannerText}>{t('offer_percent_off').replace('{n}', String(discount))}</AppText>
          </View>
        )}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={wishlistLabel}
          accessibilityState={{ selected: saved }}
          hitSlop={6}
          onPress={() => toggleWishlist(offer.id)}
          style={({ pressed }) => [styles.overlayBottomEnd, styles.heart, saved && styles.heartSaved, pressed && styles.heartPressed]}
        >
          <LineIcon name="heart" size={18} color={saved ? colors.white : colors.textMuted} fill={saved ? colors.white : 'none'} strokeWidth={2.2} />
        </Pressable>
      </View>
      <View style={styles.body}>
        <AppText style={styles.business}>{offer.businessName}</AppText>
        <AppText style={styles.title} numberOfLines={2}>{offer.title}</AppText>
        {!!offer.location && <AppText style={styles.location}>{offer.location}</AppText>}
        <View style={styles.priceRow}>
          <AppText ltr style={styles.price}>{formatPrice(offer.offerPrice)}</AppText>
          {offer.originalPrice > offer.offerPrice && (
            <AppText ltr style={styles.original}>{formatPrice(offer.originalPrice)}</AppText>
          )}
        </View>
        <View style={styles.cta}>
          <AppText style={styles.ctaText}>{t('offer_view_cta')}</AppText>
          <Svg
            width={16}
            height={16}
            viewBox="0 0 24 24"
            fill="none"
            stroke={colors.brand}
            strokeWidth={2.5}
            strokeLinecap="round"
            strokeLinejoin="round"
            style={isRtl && styles.flip}
          >
            <Path d="M5 12h14M12 5l7 7-7 7" />
          </Svg>
        </View>
      </View>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.borderLight,
    overflow: 'hidden',
    marginBottom: 16,
  },
  pressed: { opacity: 0.85 },
  image: { width: '100%', aspectRatio: 16 / 9 },
  imagePlaceholder: { backgroundColor: colors.brandLight },
  overlay: { position: 'absolute', top: 12 },
  overlayStart: { start: 12 },
  overlayEnd: { end: 12 },
  overlayBottomEnd: { position: 'absolute', bottom: 12, end: 12 },
  // Web: the white / red-500 heart on components/discover/OfferCard.tsx.
  heart: {
    width: 36,
    height: 36,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    ...webOnly({ cursor: 'pointer' }),
  },
  heartSaved: { backgroundColor: '#ef4444' },
  heartPressed: { transform: [{ scale: 0.92 }] },
  category: {
    maxWidth: '55%',
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  categoryText: { fontSize: 12, fontWeight: '700', color: colors.heading },
  banner: { backgroundColor: colors.brand, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 },
  bannerText: { fontSize: 13, fontWeight: '800', color: colors.white, letterSpacing: 0.3 },
  body: { padding: 16 },
  business: { fontSize: 12, fontWeight: '700', color: colors.brand, letterSpacing: 0.5, marginBottom: 4 },
  title: { fontSize: 17, fontWeight: '700', color: colors.textStrong, marginBottom: 4 },
  location: { fontSize: 13, color: colors.textMuted, marginBottom: 8 },
  priceRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  price: { fontSize: 18, fontWeight: '900', color: colors.textStrong },
  original: { fontSize: 14, color: colors.textFaint, textDecorationLine: 'line-through' },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
  },
  ctaText: { fontSize: 15, fontWeight: '700', color: colors.brand },
  flip: { transform: [{ scaleX: -1 }] },
})

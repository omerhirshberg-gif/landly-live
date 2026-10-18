import { Pressable, StyleSheet, View } from 'react-native'
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withSpring } from 'react-native-reanimated'
import Svg, { Path } from 'react-native-svg'
import { CATEGORY_TILES } from '@shared/categories'
import { getOfferDiscountPercent, type OfferDocument } from '@shared/firebase/offers'
import { REDEMPTION_METHOD_LABEL_KEYS, type RedemptionMethod } from '@shared/offers/redemption'
import { formatPrice } from '@shared/format'
import { useWishlist } from '@shared/firebase/useWishlist'
import AppText from './AppText'
import LineIcon, { type LineIconName } from './LineIcon'
import PerkImage from './PerkImage'
import { useLang } from '../i18n/LangProvider'
import { webOnly } from '../lib/webStyles'
import { colors, radius } from '../theme'

export const REDEMPTION_METHOD_ICONS: Record<RedemptionMethod, LineIconName> = {
  in_store: 'tag',
  online: 'globe',
  phone_booking: 'phone',
}

// A press settles quickly without bouncing past rest.
const PRESS_SPRING = { damping: 20, stiffness: 400, mass: 0.6 }

// A perk: photo (or branded fallback) with its category badge, then the
// business, the offer, how it's redeemed and where, and the price. The whole
// card is the button; the CTA line only says what tapping does. The heart at
// the photo's bottom end corner saves or un-saves the perk in the member's
// wishlist, shared live with the website. Compact, so a feed shows two or
// more perks per screen: a 2:1 photo capped at 180pt, and the price sharing
// one row with the CTA. A list already scoped to one category passes
// `showCategoryBadge={false}`, since every card would repeat the same pill.
// Same anatomy as the website's components/discover/OfferCard.tsx.
export default function OfferCard({
  offer,
  onPress,
  showCategoryBadge = true,
}: {
  offer: OfferDocument
  onPress: () => void
  showCategoryBadge?: boolean
}) {
  const { t, isRtl } = useLang()
  const discount = getOfferDiscountPercent(offer.originalPrice, offer.offerPrice)
  const tile = CATEGORY_TILES.find((c) => c.category === offer.category)
  const { isWishlisted, toggleWishlist } = useWishlist()
  const saved = isWishlisted(offer.id)
  const wishlistLabel = saved ? t('btn_remove_from_wishlist') : t('btn_add_to_wishlist')

  // Press feedback: a slight spring scale, skipped under Reduce Motion.
  const reduced = useReducedMotion()
  const scale = useSharedValue(1)
  const pressStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }] }))
  const pressTo = (value: number) => {
    if (!reduced) scale.set(withSpring(value, PRESS_SPRING))
  }

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
      onPressIn={() => pressTo(0.98)}
      onPressOut={() => pressTo(1)}
    >
      <Animated.View style={[styles.card, pressStyle]}>
        <View style={styles.media}>
          <PerkImage uri={offer.imageUrl} category={offer.category} businessName={offer.businessName} />
          {showCategoryBadge && tile && (
            <View style={[styles.overlay, styles.overlayStart, styles.category]}>
              <AppText style={styles.categoryText} numberOfLines={1}>
                {`${tile.emoji} ${t(tile.labelKey)}`}
              </AppText>
            </View>
          )}
          {discount > 0 && (
            <View style={[styles.overlayBottomStart, styles.discount]}>
              <AppText style={styles.discountText}>{t('offer_percent_off').replace('{n}', String(discount))}</AppText>
            </View>
          )}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={wishlistLabel}
            accessibilityState={{ selected: saved }}
            // 36px circle + 6px slop on each side = a 48px touch target.
            hitSlop={6}
            onPress={() => toggleWishlist(offer.id)}
            style={({ pressed }) => [styles.overlayBottomEnd, styles.heart, saved && styles.heartSaved, pressed && styles.heartPressed]}
          >
            <LineIcon name="heart" size={18} color={saved ? colors.white : colors.textMuted} fill={saved ? colors.white : 'none'} strokeWidth={2.2} />
          </Pressable>
        </View>

        <View style={styles.body}>
          <AppText style={styles.business} numberOfLines={1}>{offer.businessName}</AppText>
          <AppText style={styles.title} numberOfLines={2}>{offer.title}</AppText>

          <View style={styles.metaRow}>
            <View style={styles.methodChip}>
              <LineIcon name={REDEMPTION_METHOD_ICONS[offer.redemptionMethod]} size={13} color={colors.brand} strokeWidth={2.2} />
              <AppText style={styles.methodText}>{t(REDEMPTION_METHOD_LABEL_KEYS[offer.redemptionMethod])}</AppText>
            </View>
            {!!offer.location && (
              <View style={styles.location}>
                <LineIcon name="pin" size={13} color={colors.textFaint} strokeWidth={2} />
                <AppText style={styles.locationText} numberOfLines={1}>{offer.location}</AppText>
              </View>
            )}
          </View>

          <View style={styles.footer}>
            <View style={styles.priceRow}>
              <AppText ltr style={styles.price}>{formatPrice(offer.offerPrice)}</AppText>
              {discount > 0 && <AppText ltr style={styles.original}>{formatPrice(offer.originalPrice)}</AppText>}
            </View>
            <View style={styles.cta}>
              <AppText style={styles.ctaText}>{t('offer_view_cta')}</AppText>
              <Svg
                width={14}
                height={14}
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
        </View>
      </Animated.View>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  // Web: bg-white, border #E2E8F0, rounded-2xl, shadow-sm.
  card: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 12,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  // Clips the photo to the card's top corners (the card itself can't clip, or iOS would drop its shadow).
  media: {
    width: '100%',
    aspectRatio: 2,
    maxHeight: 180,
    borderTopLeftRadius: radius.lg - 1,
    borderTopRightRadius: radius.lg - 1,
    overflow: 'hidden',
    backgroundColor: colors.brandTint,
  },
  overlay: { position: 'absolute', top: 10 },
  overlayStart: { start: 10 },
  overlayBottomEnd: { position: 'absolute', bottom: 10, end: 10 },
  overlayBottomStart: { position: 'absolute', bottom: 10, start: 10 },
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
    maxWidth: '65%',
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: radius.pill,
    paddingHorizontal: 9,
    paddingVertical: 3,
  },
  categoryText: { fontSize: 11, fontWeight: '600', color: colors.heading },
  body: { padding: 12 },
  business: { fontSize: 16, fontWeight: '700', color: colors.heading, lineHeight: 22 },
  title: { fontSize: 14, lineHeight: 20, color: colors.body, marginTop: 2 },
  metaRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  methodChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: colors.borderLight,
    borderRadius: radius.pill,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  methodText: { fontSize: 12, fontWeight: '600', color: colors.body },
  location: { flexDirection: 'row', alignItems: 'center', gap: 4, flexShrink: 1 },
  locationText: { fontSize: 12, color: colors.textFaint, flexShrink: 1 },
  // Price at the start, "View deal" at the end, on one row.
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginTop: 10 },
  priceRow: { flexDirection: 'row', alignItems: 'baseline', flexWrap: 'wrap', columnGap: 8, flexShrink: 1 },
  price: { fontSize: 18, fontWeight: '800', color: colors.brand },
  original: { fontSize: 14, color: colors.textFaint, textDecorationLine: 'line-through' },
  // Web: components/discover/DiscountBadge.tsx -- solid emerald-700, white text (5.5:1).
  discount: {
    backgroundColor: '#047857',
    borderRadius: radius.pill,
    paddingHorizontal: 9,
    paddingVertical: 4,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    elevation: 2,
  },
  discountText: { fontSize: 12, fontWeight: '800', color: colors.white, letterSpacing: 0.5, textTransform: 'uppercase' },
  cta: { flexDirection: 'row', alignItems: 'center', gap: 4, flexShrink: 0 },
  ctaText: { fontSize: 14, fontWeight: '700', color: colors.brand },
  flip: { transform: [{ scaleX: -1 }] },
})

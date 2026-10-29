import { Pressable, StyleSheet, View } from 'react-native'
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withSpring } from 'react-native-reanimated'
import Svg, { Path } from 'react-native-svg'
import { CATEGORY_TILES } from '@shared/categories'
import { getOfferDiscountPercent, type OfferDocument } from '@shared/firebase/offers'
import { REDEMPTION_METHOD_LABEL_KEYS } from '@shared/offers/redemption'
import { formatPrice } from '@shared/format'
import { useWishlist } from '@shared/firebase/useWishlist'
import { localizeText } from '@shared/i18n/contentTranslation'
import { localizedBusinessName } from '@shared/business/businessText'
import { formatDistance, offerPlaceLabel } from '@shared/geo'
import AppText from './AppText'
import ContentText from './ContentText'
import DealMedia, { DEAL_BADGE } from './DealMedia'
import Emoji from './Emoji'
import LineIcon from './LineIcon'
import { useLang } from '../i18n/LangProvider'
import { categoryGlyph } from '../lib/categoryGlyphs'
import { impact } from '../lib/haptics'
import { webOnly } from '../lib/webStyles'
import { colors, radius } from '../theme'

/**
 * 'standard': full width, for the vertical feeds (Perks, a category, the
 * wishlist). 'compact': the same card with a short photo and smaller type.
 * 'carousel': compact, filling the fixed-width slot its horizontal rail gives
 * it, with two title lines reserved so neighbouring cards line up.
 */
export type OfferCardVariant = 'standard' | 'compact' | 'carousel'

// A press settles quickly without bouncing past rest.
const PRESS_SPRING = { damping: 20, stiffness: 400, mass: 0.6 }

// A perk: a full-width hero picture with the business's badge hanging over
// its foot (DealMedia.tsx: the deal's photo with the business's initial, or
// the category's panel with its logo), then the business, the offer, how
// it's redeemed and where, and the price. Over the hero: the category pill
// at the top start corner, the discount at the top end and the heart at the
// bottom end, which saves or un-saves the perk in the member's wishlist,
// shared live with the website. The whole card is the button; the CTA line
// only says what tapping does. The price and the struck-through original
// share one row with the CTA. A list already scoped to one category passes
// `showCategoryBadge={false}`, since every card would repeat the same pill.
// Every position is start/end, so Hebrew mirrors the card.
export default function OfferCard({
  offer,
  onPress,
  showCategoryBadge = true,
  variant = 'standard',
  distanceKm,
}: {
  offer: OfferDocument
  onPress: () => void
  showCategoryBadge?: boolean
  variant?: OfferCardVariant
  /** Kilometres from the member's location (Near me); shown before the place. */
  distanceKm?: number | null
}) {
  const { t, isRtl, lang } = useLang()
  const title = localizeText(offer.title, offer.translations, lang, 'title')
  const name = localizedBusinessName(offer, lang)
  const place = offerPlaceLabel(offer, lang)
  const distance = typeof distanceKm === 'number' ? formatDistance(distanceKm, lang) : null
  const compact = variant !== 'standard'
  const discount = getOfferDiscountPercent(offer.originalPrice, offer.offerPrice)
  const tile = CATEGORY_TILES.find((c) => c.category === offer.category)
  const badge = DEAL_BADGE[compact ? 'compact' : 'standard']
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
      <Animated.View style={[styles.card, variant === 'carousel' && styles.cardCarousel, pressStyle]}>
        <DealMedia uri={offer.imageUrl} logoUri={offer.businessLogoUrl ?? ''} category={offer.category} businessName={name.text} size={compact ? 'compact' : 'standard'}>
          {showCategoryBadge && tile && (
            <View style={[styles.overlayTopStart, styles.pill, styles.category]}>
              <Emoji glyph={categoryGlyph(tile.category)} size={compact ? 11 : 12} />
              <AppText style={[styles.categoryText, compact && styles.categoryTextCompact]} numberOfLines={1}>
                {t(tile.labelKey)}
              </AppText>
            </View>
          )}
          {discount > 0 && (
            <View style={[styles.overlayTopEnd, styles.pill, styles.discount]}>
              <AppText style={[styles.discountText, compact && styles.discountTextCompact]}>{t('offer_percent_off').replace('{n}', String(discount))}</AppText>
            </View>
          )}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={wishlistLabel}
            accessibilityState={{ selected: saved }}
            // A 36px circle + 6px slop (compact: 32px + 8px) = a 48px touch target.
            hitSlop={compact ? 8 : 6}
            onPress={() => {
              impact()
              toggleWishlist(offer.id)
            }}
            style={({ pressed }) => [
              styles.overlayBottomEnd,
              styles.heart,
              compact && styles.heartCompact,
              saved && styles.heartSaved,
              pressed && styles.heartPressed,
            ]}
          >
            <LineIcon name="heart" size={compact ? 16 : 18} color={saved ? colors.white : colors.textMuted} fill={saved ? colors.white : 'none'} strokeWidth={2} />
          </Pressable>
        </DealMedia>

        <View style={[styles.body, compact && styles.bodyCompact]}>
          {/* Clear of the badge hanging over the hero's foot. */}
          <AppText style={[styles.business, compact && styles.businessCompact, { marginStart: badge + 8 }]} numberOfLines={1}>
            {name.text}
          </AppText>
          <ContentText contentLang={title.lang} style={[styles.title, compact && styles.titleCompact, variant === 'carousel' && styles.titleReserved]} numberOfLines={2}>
            {title.text}
          </ContentText>

          {/* Compact: one line, the location giving way to the method. */}
          <View style={[styles.metaRow, compact && styles.metaRowCompact]}>
            <View style={styles.methodChip}>
              <AppText style={[styles.methodText, compact && styles.metaTextCompact]}>{t(REDEMPTION_METHOD_LABEL_KEYS[offer.redemptionMethod])}</AppText>
            </View>
            {(!!place || !!distance) && (
              <View style={styles.location}>
                <LineIcon name="pin" size={13} color={distance ? colors.brand : colors.textFaint} strokeWidth={2} />
                {/* The distance keeps its own run ("1.2 ק״מ") inside either direction. */}
                {!!distance && <AppText style={[styles.locationText, styles.distanceText, compact && styles.metaTextCompact]}>{`\u2068${distance}\u2069`}</AppText>}
                {!!place && (
                  <AppText style={[styles.locationText, compact && styles.metaTextCompact]} numberOfLines={1}>
                    {distance ? `· ${place}` : place}
                  </AppText>
                )}
              </View>
            )}
          </View>

          <View style={[styles.footer, compact && styles.footerCompact]}>
            <View style={styles.priceRow}>
              <AppText ltr style={[styles.price, compact && styles.priceCompact]}>{formatPrice(offer.offerPrice)}</AppText>
              {discount > 0 && <AppText ltr style={[styles.original, compact && styles.originalCompact]}>{formatPrice(offer.originalPrice)}</AppText>}
            </View>
            <View style={styles.cta}>
              <AppText style={[styles.ctaText, compact && styles.ctaTextCompact]}>{t('offer_view_cta')}</AppText>
              <Svg
                width={compact ? 13 : 14}
                height={compact ? 13 : 14}
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
    shadowColor: colors.textStrong,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  // The rail spaces its cards itself.
  cardCarousel: { marginBottom: 0 },
  // Over the hero: the pills at its top corners, the heart at its bottom end
  // (the badge holds the bottom start).
  overlayTopStart: { position: 'absolute', top: 10, start: 10 },
  overlayTopEnd: { position: 'absolute', top: 10, end: 10 },
  overlayBottomEnd: { position: 'absolute', bottom: 10, end: 10 },
  // A soft drop shadow lifts the pills and the heart off any photo.
  pill: {
    borderRadius: radius.pill,
    shadowColor: colors.textStrong,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 2,
  },
  heart: {
    width: 36,
    height: 36,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    shadowColor: colors.textStrong,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 2,
    ...webOnly({ cursor: 'pointer' }),
  },
  heartCompact: { width: 32, height: 32 },
  heartSaved: { backgroundColor: colors.heart },
  heartPressed: { transform: [{ scale: 0.92 }] },
  // The emoji and the label are separate views, so the row's direction orders them.
  category: {
    maxWidth: '62%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    paddingStart: 6,
    paddingEnd: 9,
    paddingVertical: 2,
  },
  categoryText: { flexShrink: 1, fontSize: 11, fontWeight: '600', color: colors.heading },
  categoryTextCompact: { fontSize: 10 },
  body: { paddingHorizontal: 12, paddingTop: 9, paddingBottom: 12 },
  bodyCompact: { paddingHorizontal: 10, paddingTop: 9, paddingBottom: 10 },
  business: { fontSize: 16, fontWeight: '700', color: colors.heading, lineHeight: 22 },
  businessCompact: { fontSize: 14, lineHeight: 19 },
  title: { fontSize: 14, lineHeight: 20, color: colors.body, marginTop: 2 },
  titleCompact: { fontSize: 13, lineHeight: 18, marginTop: 1 },
  titleReserved: { minHeight: 36 },
  metaRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginTop: 6 },
  metaRowCompact: { flexWrap: 'nowrap', gap: 6, marginTop: 6 },
  metaTextCompact: { fontSize: 11 },
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
  distanceText: { flexShrink: 0, fontWeight: '600', color: colors.brand },
  // Price at the start, "View deal" at the end, on one row.
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginTop: 8 },
  footerCompact: { gap: 8, marginTop: 8 },
  priceRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', columnGap: 6, rowGap: 2, flexShrink: 1 },
  price: { fontSize: 18, fontWeight: '800', color: colors.brand },
  priceCompact: { fontSize: 16 },
  original: { fontSize: 14, color: colors.textFaint, textDecorationLine: 'line-through' },
  originalCompact: { fontSize: 12 },
  // Web: components/discover/DiscountBadge.tsx -- solid emerald-700, white text (5.5:1).
  discount: { backgroundColor: colors.discount, paddingHorizontal: 8, paddingVertical: 4 },
  discountText: { fontSize: 11, fontWeight: '800', color: colors.white, letterSpacing: 0.3, textTransform: 'uppercase' },
  discountTextCompact: { fontSize: 10 },
  cta: { flexDirection: 'row', alignItems: 'center', gap: 4, flexShrink: 0 },
  ctaText: { fontSize: 14, fontWeight: '700', color: colors.brand },
  ctaTextCompact: { fontSize: 13 },
  flip: { transform: [{ scaleX: -1 }] },
})

import { Pressable, StyleSheet, View } from 'react-native'
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withSpring } from 'react-native-reanimated'
import Svg, { Path } from 'react-native-svg'
import { getOfferDiscountPercent, type OfferDocument } from '@shared/firebase/offers'
import { formatPrice } from '@shared/format'
import { useWishlist } from '@shared/firebase/useWishlist'
import { localizeText } from '@shared/i18n/contentTranslation'
import { localizedBusinessName } from '@shared/business/businessText'
import { formatDistance, offerPlaceLabel } from '@shared/geo'
import AppText from './AppText'
import ContentText from './ContentText'
import DealMedia from './DealMedia'
import LineIcon from './LineIcon'
import MerchantBadge from './MerchantBadge'
import OfferTags from './OfferTags'
import { useLang } from '../i18n/LangProvider'
import { impact } from '../lib/haptics'
import { badgeLogoUri, businessInitial, secureImageUrl } from '../lib/imageSource'
import { useDealImage } from '../lib/useDealImage'
import { webOnly } from '../lib/webStyles'
import { colors, radius } from '../theme'

/**
 * 'standard': full width, for the vertical feeds (Perks, a category, the
 * wishlist). 'compact': the same card and 16:9 photo with smaller type.
 * 'carousel': compact, filling the fixed-width slot its horizontal rail gives
 * it, with two title lines reserved so neighbouring cards line up.
 */
export type OfferCardVariant = 'standard' | 'compact' | 'carousel'

/** The logo tile's height (web: h-12, on a phone). */
const LOGO_HEIGHT = 48

// A press settles quickly without bouncing past rest.
const PRESS_SPRING = { damping: 20, stiffness: 400, mass: 0.6 }

// A perk: a full-width hero picture (DealMedia.tsx: the deal's photo, or the
// category's panel), then a white body with the category and how it's redeemed,
// the offer and the business, where, and the price. Over the hero: the discount
// ribbon tied to the top end corner, the business's logo box across the bottom
// start corner and the heart at the bottom end, which saves
// or un-saves the perk in the member's wishlist,
// shared live with the website. The whole card is the button; the CTA line
// only says what tapping does. The price and the struck-through original
// share one row with the CTA. A list already scoped to one category passes
// `showCategoryBadge={false}`, since every card would repeat the same tag.
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
  const image = useDealImage(offer.imageUrl)
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
        <DealMedia image={image} category={offer.category}>
          {discount > 0 && (
            <View style={styles.ribbon}>
              <AppText ltr accessibilityLabel={t('offer_percent_off').replace('{n}', String(discount))} style={[styles.ribbonText, compact && styles.ribbonTextCompact]}>{`-${discount}%`}</AppText>
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
          <MerchantBadge
            logoUri={badgeLogoUri(secureImageUrl(offer.businessLogoUrl ?? ''), image.uri, image.role)}
            initial={businessInitial(name.text)}
            height={LOGO_HEIGHT}
            style={styles.logo}
          />
        </DealMedia>

        <View style={[styles.body, compact && styles.bodyCompact]}>
          <OfferTags category={offer.category} method={offer.redemptionMethod} showCategory={showCategoryBadge} />
          <ContentText contentLang={title.lang} style={[styles.title, compact && styles.titleCompact, variant === 'carousel' && styles.titleReserved]} numberOfLines={2}>
            {title.text}
          </ContentText>
          <AppText style={[styles.business, compact && styles.businessCompact]} numberOfLines={1}>
            {name.text}
          </AppText>

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
  // Web: bg-white, border-slate-200/80, rounded-2xl, shadow-[0_4px_20px_-4px_rgba(0,0,0,0.07)].
  // Not clipped here, which would cut the shadow; DealMedia clips the photo.
  card: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: 'rgba(226, 232, 240, 0.8)',
    marginBottom: 12,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.07,
    shadowRadius: 10,
    elevation: 3,
  },
  // The rail spaces its cards itself.
  cardCarousel: { marginBottom: 0 },
  // Over the hero: the heart at its bottom end.
  overlayBottomEnd: { position: 'absolute', bottom: 10, end: 10 },
  // Across the hero's foot: 20pt of it hangs over the body (styles.body's top padding clears it).
  logo: { position: 'absolute', bottom: -20, start: 12 },
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
  body: { paddingHorizontal: 12, paddingTop: 28, paddingBottom: 12 },
  bodyCompact: { paddingHorizontal: 10, paddingTop: 28, paddingBottom: 10 },
  title: { fontSize: 16, lineHeight: 22, fontWeight: '700', color: colors.heading },
  titleCompact: { fontSize: 14, lineHeight: 19 },
  titleReserved: { minHeight: 38 },
  business: { fontSize: 14, lineHeight: 19, color: colors.body, marginTop: 2 },
  businessCompact: { fontSize: 13, lineHeight: 18, marginTop: 1 },
  metaTextCompact: { fontSize: 11 },
  location: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6 },
  locationText: { fontSize: 12, color: colors.textFaint, flexShrink: 1 },
  distanceText: { flexShrink: 0, fontWeight: '600', color: colors.brand },
  // Price at the start, "View deal" at the end, on one row.
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginTop: 8 },
  footerCompact: { gap: 8, marginTop: 8 },
  priceRow: { flexDirection: 'row', alignItems: 'baseline', flexWrap: 'wrap', columnGap: 6, rowGap: 2, flexShrink: 1 },
  price: { fontSize: 18, fontWeight: '800', color: colors.brand },
  priceCompact: { fontSize: 16 },
  original: { fontSize: 14, color: colors.textFaint, textDecorationLine: 'line-through' },
  originalCompact: { fontSize: 12 },
  // Web: components/discover/DiscountBadge.tsx -- solid emerald-700, white text.
  // The card doesn't clip (its shadow), so the ribbon rounds the card's corner itself, inside the 1pt border.
  ribbon: {
    position: 'absolute',
    top: 0,
    end: 0,
    backgroundColor: colors.discountBadge,
    borderTopEndRadius: 15,
    borderBottomStartRadius: 15,
    paddingHorizontal: 12,
    paddingVertical: 4,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  ribbonText: { fontSize: 13, lineHeight: 18, fontWeight: '700', color: colors.white },
  ribbonTextCompact: { fontSize: 12, lineHeight: 16 },
  cta: { flexDirection: 'row', alignItems: 'center', gap: 4, flexShrink: 0 },
  ctaText: { fontSize: 14, fontWeight: '700', color: colors.brand },
  ctaTextCompact: { fontSize: 13 },
  flip: { transform: [{ scaleX: -1 }] },
})

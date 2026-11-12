import { Pressable, StyleSheet, View } from 'react-native'
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
import CategoryIcon from './CategoryIcon'
import { CATEGORY_TILES } from '@shared/categories'
import { REDEMPTION_METHOD_LABEL_KEYS } from '@shared/offers/redemption'
import ScalePressable from './ScalePressable'
import { isMultiChain, PerkReachLine } from './PerkReach'
import { useLang } from '../i18n/LangProvider'
import { impact, tick } from '../lib/haptics'
import { badgeLogoUri, businessInitial, secureImageUrl } from '../lib/imageSource'
import { useDealImage } from '../lib/useDealImage'
import { webOnly } from '../lib/webStyles'
import { colors, radius } from '../theme'

/**
 * 'standard': full width, for the vertical feeds (Perks, a category, the
 * wishlist). 'compact': the same card with smaller type.
 * 'carousel': compact, filling the fixed-width slot its horizontal rail gives
 * it, with two title lines reserved so neighbouring cards line up.
 */
export type OfferCardVariant = 'standard' | 'compact' | 'carousel'

/** The logo tile's height (web: h-10) and how far it hangs over the body. */
const LOGO_HEIGHT = 40
/** The feed cards' picture: 2:1, never taller than 172pt (the carousel's slot keeps 16:9 inside the same cap). */
const HERO_RATIO = 2
const HERO_MAX_HEIGHT = 172

// A perk: a full-width hero picture (DealMedia.tsx: the deal's photo, or the
// category's panel), then a white body with
// the offer, the business and where on one line, and the price. Over the hero: the redemption method (and category) tag at the top start, the discount
// ribbon tied to the top end corner, the business's logo box across the bottom
// start corner and the heart at the bottom end, which saves
// or un-saves the perk in the member's wishlist,
// shared live with the website. The whole card is the button: it springs down
// under the finger (ScalePressable) with a selection tick as it opens, so there
// is no "View deal" link to read. The price and the struck-through original
// share one baseline. A list already scoped to one category passes
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
  const { t, lang } = useLang()
  const title = localizeText(offer.title, offer.translations, lang, 'title')
  const name = localizedBusinessName(offer, lang)
  const place = offerPlaceLabel(offer, lang)
  const distance = typeof distanceKm === 'number' ? formatDistance(distanceKm, lang) : null
  const compact = variant !== 'standard'
  const multiChain = isMultiChain(offer)
  // A Multipass perk has no street address: the chains (or "nationwide") say where it works.
  const reach = multiChain || (offer.fulfillmentType === 'multipass_pool' && !place)
  const tile = CATEGORY_TILES.find((c) => c.category === offer.category)
  const discount = getOfferDiscountPercent(offer.originalPrice, offer.offerPrice)
  const image = useDealImage(offer.imageUrl)
  const { isWishlisted, toggleWishlist } = useWishlist()
  const saved = isWishlisted(offer.id)
  const wishlistLabel = saved ? t('btn_remove_from_wishlist') : t('btn_add_to_wishlist')

  return (
    <ScalePressable
      pressedScale={0.98}
      style={variant === 'carousel' && styles.fill}
      accessibilityRole="button"
      // The card is one element to a screen reader, which can't reach the
      // heart inside it, so saving is also offered as an action on the card.
      accessibilityActions={[{ name: 'wishlist', label: wishlistLabel }]}
      onAccessibilityAction={(e) => {
        if (e.nativeEvent.actionName === 'wishlist') toggleWishlist(offer.id)
      }}
      onPress={() => {
        // A selection tick as a perk is opened.
        tick()
        onPress()
      }}
    >
      <View style={[styles.card, variant === 'carousel' && styles.cardCarousel]}>
        <DealMedia image={image} category={offer.category} ratio={variant === 'carousel' ? 16 / 9 : HERO_RATIO} maxHeight={HERO_MAX_HEIGHT}>
          <View style={styles.method}>
            {showCategoryBadge && tile && <CategoryIcon category={tile.category} size={12} color={colors.body} strokeWidth={1.5} />}
            <AppText style={styles.methodText} numberOfLines={1}>{multiChain ? t('perk_multi_chain_badge') : t(REDEMPTION_METHOD_LABEL_KEYS[offer.redemptionMethod])}</AppText>
          </View>
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
            fixed
            style={styles.logo}
          />
        </DealMedia>

        <View style={[styles.body, compact && styles.bodyCompact]}>
          <ContentText contentLang={title.lang} style={[styles.title, compact && styles.titleCompact]} numberOfLines={2}>
            {title.text}
          </ContentText>
          {/* One dense line: the business, then where (or how far). */}
          <View style={styles.meta}>
            <AppText style={[styles.business, compact && styles.businessCompact]} numberOfLines={1}>
              {name.text}
            </AppText>
            {reach && (
              <>
                <AppText style={styles.dot} accessibilityElementsHidden importantForAccessibility="no">·</AppText>
                <PerkReachLine offer={offer} hasPlace={!!place} compact={compact} />
              </>
            )}
            {!reach && (!!place || !!distance) && (
              <>
                <AppText style={styles.dot} accessibilityElementsHidden importantForAccessibility="no">·</AppText>
                <LineIcon name="pin" size={12} color={distance ? colors.brand : colors.textFaint} strokeWidth={1.75} />
                {/* The distance keeps its own run ("1.2 ק״מ") inside either direction. */}
                {!!distance && <AppText style={[styles.locationText, styles.distanceText, compact && styles.metaTextCompact]}>{`\u2068${distance}\u2069`}</AppText>}
                {!!place && (
                  <AppText style={[styles.locationText, compact && styles.metaTextCompact]} numberOfLines={1}>
                    {distance ? `· ${place}` : place}
                  </AppText>
                )}
              </>
            )}
          </View>

          {/* One baseline: the price, then the struck-through original. Digits and "₪" run left to right in Hebrew. */}
          <View style={styles.priceRow}>
            <AppText ltr style={[styles.price, compact && styles.priceCompact]}>{formatPrice(offer.offerPrice)}</AppText>
            {discount > 0 && <AppText ltr style={[styles.original, compact && styles.originalCompact]}>{formatPrice(offer.originalPrice)}</AppText>}
          </View>
        </View>
      </View>
    </ScalePressable>
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
  cardCarousel: { marginBottom: 0, flex: 1 },
  // A carousel card fills its stretched slot, so every card's price sits along the same foot.
  fill: { flex: 1 },
  // Over the hero: the heart at its bottom end.
  overlayBottomEnd: { position: 'absolute', bottom: 10, end: 10 },
  // Across the hero's foot: 16pt of it hangs over the body (styles.body's top padding clears it).
  logo: { position: 'absolute', bottom: -16, start: 12 },
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
  body: { flexGrow: 1, padding: 12, paddingTop: 22 },
  bodyCompact: { flexGrow: 1, padding: 12, paddingTop: 22 },
  title: { fontSize: 15, lineHeight: 20, fontWeight: '700', color: colors.heading },
  titleCompact: { fontSize: 14, lineHeight: 19 },
  business: { flexShrink: 1, fontSize: 13, lineHeight: 18, color: colors.body },
  businessCompact: { fontSize: 12, lineHeight: 17 },
  metaTextCompact: { fontSize: 11 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 },
  dot: { fontSize: 12, color: colors.textFaint },
  // The method (and category) tag over the photo's top start corner.
  method: {
    position: 'absolute',
    top: 10,
    start: 10,
    maxWidth: '60%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255, 255, 255, 0.92)',
  },
  methodText: { flexShrink: 1, fontSize: 11, lineHeight: 15, fontWeight: '600', color: colors.body },
  locationText: { fontSize: 12, color: colors.textFaint, flexShrink: 2 },
  distanceText: { flexShrink: 0, fontWeight: '600', color: colors.brand },
  // The price row rides the card's foot (`marginTop: auto`), on one baseline.
  priceRow: { flexDirection: 'row', alignItems: 'baseline', columnGap: 8, marginTop: 'auto', paddingTop: 6 },
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
    borderCurve: 'continuous',
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
})

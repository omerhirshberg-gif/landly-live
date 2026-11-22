import { memo, useState } from 'react'
import { Pressable, StyleSheet, View } from 'react-native'
import { getOfferDiscountPercent, type OfferDocument } from '@shared/firebase/offers'
import { formatPrice } from '@shared/format'
import { useIsWishlisted, useToggleWishlist } from '@shared/firebase/useWishlist'
import { localizeText } from '@shared/i18n/contentTranslation'
import { localizedBusinessName } from '@shared/business/businessText'
import AppText from './AppText'
import ContentText from './ContentText'
import DealMedia from './DealMedia'
import LineIcon from './LineIcon'
import MerchantBadge from './MerchantBadge'
import ScalePressable from './ScalePressable'
import { expiryPill } from '@shared/offers/cardExpiry'
import { useLang } from '../i18n/LangProvider'
import { impact, tick } from '../lib/haptics'
import { displayTitle } from '@shared/offers/superTav'
import { heroLogoIsFallback, heroLogoSource, isRaayonitOffer, raayonitImageOpts } from '../lib/logoHero'
import { badgeLogoUri, secureImageUrl } from '../lib/imageSource'
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
/** The card's border, inside which the picture sits. */
const CARD_BORDER = 1
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
//
// Memoized, and fed only stable props (the offer, the module-level `openOffer`,
// the slot width), so a list re-rendering around it, a search keystroke or a
// heart saved on another card never re-renders it: its own heart subscribes to
// its own offer id (useIsWishlisted).
export default memo(function OfferCard({
  offer,
  onOpen,
  variant = 'standard',
  nationwide = false,
  width,
}: {
  offer: OfferDocument
  /** Opens the perk; called with this card's offer, so a list can pass one stable function to every card. */
  onOpen: (offer: OfferDocument) => void
  /** Kept so callers need no change; the redemption and category tag no longer sits on the card (it lives on the offer page). */
  showCategoryBadge?: boolean
  variant?: OfferCardVariant
  /** Kept so callers need no change; the card shows no place or distance (the offer page does). */
  distanceKm?: number | null
  /** A nationwide chain with no placeable branch, listed under a location filter: a subtle "Nationwide chain" tag, no distance. */
  nationwide?: boolean
  /** The card's outer width when the list knows it: the picture is sized on the first pass. */
  width?: number
}) {
  const { t, lang } = useLang()
  const title = localizeText(offer.title, offer.translations, lang, 'title')
  const name = localizedBusinessName(offer, lang)
  const compact = variant !== 'standard'
  // A multi-denomination offer reads "From ₪89" with its values; the classic fields are its cheapest variant.
  const multiValue = (offer.variants?.length ?? 0) > 1
  const discount = getOfferDiscountPercent(offer.originalPrice, offer.offerPrice)
  const image = useDealImage(offer.imageUrl, raayonitImageOpts(offer))
  const heroLogo = heroLogoSource(offer)
  // Read once per mount, since render must stay pure.
  const [now] = useState(Date.now)
  const pill = expiryPill(offer.expiryDate, now)
  // Rail and grid cards keep two title lines so neighbours line up; a full-width feed card only takes what it needs.
  const reserveTitle = compact || !!width
  const saved = useIsWishlisted(offer.id)
  const toggleWishlist = useToggleWishlist()
  const wishlistLabel = saved ? t('btn_remove_from_wishlist') : t('btn_add_to_wishlist')

  return (
    <ScalePressable
      pressedScale={0.98}
      style={variant === 'carousel' ? styles.fill : styles.grow}
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
        onOpen(offer)
      }}
    >
      <View style={[styles.card, variant === 'carousel' && styles.cardCarousel]}>
        <DealMedia image={image} recyclingKey={offer.id} width={width ? width - CARD_BORDER * 2 : undefined} category={offer.category} logo={heroLogo} logoSmall={heroLogoIsFallback(offer)} ratio={variant === 'carousel' ? 16 / 9 : HERO_RATIO} maxHeight={HERO_MAX_HEIGHT}>
          {pill && pill.kind !== 'expired' && (
            <View style={[styles.expiry, pill.kind === 'urgent' && styles.expiryUrgent]}>
              <AppText style={styles.expiryText} numberOfLines={1}>{t(pill.key).replace('{date}', `\u2066${pill.date}\u2069`)}</AppText>
            </View>
          )}
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
          {!heroLogo && !isRaayonitOffer(offer) && (
            <MerchantBadge
              logoUri={badgeLogoUri(secureImageUrl(offer.businessLogoUrl ?? ''), image.uri, image.role)}
              height={LOGO_HEIGHT}
              fixed
              style={styles.logo}
            />
          )}
        </DealMedia>

        <View style={[styles.body, compact && styles.bodyCompact, !!heroLogo && styles.bodyLogoHero]}>
          <ContentText contentLang={title.lang} style={[styles.title, compact && styles.titleCompact, reserveTitle && (compact ? styles.titleSlotCompact : styles.titleSlot)]} numberOfLines={2}>
            {displayTitle(offer, title.text, t('super_tav_headline'))}
          </ContentText>
          {/* The business on its own line, then where (or how far) on a full-width line below, so a long notice wraps whole. */}
          <AppText style={[styles.business, compact && styles.businessCompact]} numberOfLines={1}>
            {name.text}
          </AppText>
          {nationwide && (
            <View style={styles.nationwide}>
              <LineIcon name="globe" size={12} color={colors.textMuted} strokeWidth={1.75} />
              <AppText style={styles.nationwideText} numberOfLines={1}>{t('loc_nationwide_badge')}</AppText>
            </View>
          )}
          {/* The foot: where it is, then the price, pinned together to the card's bottom edge so every card in a row lines up. */}
          <View style={styles.foot}>
          {/* One baseline: the price, then the struck-through original. Digits and "₪" run left to right in Hebrew. */}
          <View style={styles.priceRow}>
            {multiValue ? (
              <>
                <AppText style={[styles.price, compact && styles.priceCompact]}>
                  {t('offer_card_from').split('{price}').map((part, i) => (i === 0 ? part : [<AppText key="p" ltr style={[styles.price, compact && styles.priceCompact]}>{formatPrice(offer.offerPrice)}</AppText>, part]))}
                </AppText>
              </>
            ) : (
              <>
                <AppText ltr style={[styles.price, compact && styles.priceCompact]}>{formatPrice(offer.offerPrice)}</AppText>
                {discount > 0 && <AppText ltr style={[styles.original, compact && styles.originalCompact]}>{formatPrice(offer.originalPrice)}</AppText>}
              </>
            )}
          </View>
          </View>
        </View>
      </View>
    </ScalePressable>
  )
})

const styles = StyleSheet.create({
  // Web: bg-white, border-slate-200/80, rounded-2xl, shadow-[0_4px_20px_-4px_rgba(0,0,0,0.07)].
  // Not clipped here, which would cut the shadow; DealMedia clips the photo.
  card: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    borderWidth: CARD_BORDER,
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
  // Every other layout (the grid's cells, the feed) grows to its row's height too, so the price still sits at the foot.
  grow: { flexGrow: 1 },
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
  bodyLogoHero: { paddingTop: 12 },
  title: { fontSize: 15, lineHeight: 20, fontWeight: '700', color: colors.heading },
  titleCompact: { fontSize: 14, lineHeight: 19 },
  // Two lines of room, whatever the title needs, so a row of cards shares one baseline for the brand and the foot.
  titleSlot: { minHeight: 40 },
  titleSlotCompact: { minHeight: 38 },
  // The expiry pill at the photo's top start: dark and translucent, crimson inside 48 hours.
  expiry: { position: 'absolute', top: 10, start: 10, maxWidth: '78%', paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.sm, borderCurve: 'continuous', backgroundColor: 'rgba(15, 23, 42, 0.78)' },
  expiryUrgent: { backgroundColor: '#B91C1C' },
  expiryText: { fontSize: 11, lineHeight: 15, fontWeight: '700', color: colors.white },
  nationwide: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 4, maxWidth: '100%', marginTop: 6, paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.pill, backgroundColor: colors.borderLight },
  nationwideText: { flexShrink: 1, fontSize: 11, lineHeight: 15, fontWeight: '600', color: colors.textMuted },
  business: { flexShrink: 1, fontSize: 13, lineHeight: 18, color: colors.body },
  businessCompact: { fontSize: 12, lineHeight: 17 },
  meta: { flexDirection: 'row', alignItems: 'flex-start', gap: 4, marginTop: 2 },
  // The price row rides the card's foot (`marginTop: auto`), on one baseline.
  foot: { marginTop: 'auto', paddingTop: 8 },
  priceRow: { flexDirection: 'row', alignItems: 'baseline', columnGap: 8 },
  price: { fontSize: 18, fontWeight: '800', color: colors.brand, fontVariant: ['tabular-nums'] },
  priceCompact: { fontSize: 16 },
  original: { fontSize: 14, color: colors.textFaint, textDecorationLine: 'line-through', fontVariant: ['tabular-nums'] },
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

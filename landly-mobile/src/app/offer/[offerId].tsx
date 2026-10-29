import { useCallback, useEffect, useState } from 'react'
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, View } from 'react-native'
import Animated from 'react-native-reanimated'
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
import { CATEGORY_TILES } from '@shared/categories'
import { getOffer, getOfferDiscountPercent, type OfferDocument } from '@shared/firebase/offers'
import { hasUserClaimedOffer } from '@shared/firebase/vouchers'
import { useAuth } from '@shared/firebase/useAuth'
import { useWishlist } from '@shared/firebase/useWishlist'
import { formatLongDate, formatPrice } from '@shared/format'
import { REDEMPTION_METHOD_LABEL_KEYS, redemptionSteps } from '@shared/offers/redemption'
import { useLocalizedContent } from '@shared/i18n/useLocalizedContent'
import { offerTextSources } from '@shared/offers/offerText'
import { offerFullAddress } from '@shared/geo'
import AppText from '../../components/AppText'
import ContentText from '../../components/ContentText'
import TranslationNotice from '../../components/TranslationNotice'
import Button from '../../components/Button'
import LineIcon from '../../components/LineIcon'
import GlassHeartButton from '../../components/GlassHeartButton'
import MerchantBadge from '../../components/MerchantBadge'
import NavigationButtons from '../../components/NavigationButtons'
import { CategoryPanel } from '../../components/PerkImage'
import ScreenHeader from '../../components/ScreenHeader'
import { useLang } from '../../i18n/LangProvider'
import { PANE_GAP } from '../../lib/layout'
import { badgeLogoUri, businessInitial, secureImageUrl } from '../../lib/imageSource'
import { cachedOffer } from '../../lib/openOffer'
import { useDealImage } from '../../lib/useDealImage'
import { useLayout } from '../../lib/useLayout'
import { webOnly } from '../../lib/webStyles'
import { colors, radius } from '../../theme'

// One offer as its own screen (web: /offers/[offerId]), pushed from a perk
// card as a page flip (lib/pageFlip.ts): a full-screen swipe in the reading
// direction turns it back, the same as the header's back button. The photo
// with the wishlist heart and the business's logo circle hanging off its
// foot (the perk card's two pictures, DealMedia.tsx), the business, the offer and its price, the
// description, validity and how to redeem; the Buy button sits in a bar
// pinned above the home indicator. Buy pushes the native checkout
// (app/checkout/[offerId].tsx); a finished purchase replaces it with the new
// voucher, so coming back here re-runs the claim check on focus, turning the
// Buy bar into the "already claimed" notice.
export default function OfferScreen() {
  const { t, lang, isRtl } = useLang()
  const insets = useSafeAreaInsets()
  // Unfolded (600pt and up; src/lib/layout.ts): the picture and the details
  // side by side, either side of the fold, in the reading direction (the
  // picture on the right in Hebrew), and the buy button under the details
  // pane. Folding back re-lays it out as the one phone column. The side
  // padding carries the safe-area insets, so a landscape camera cutout never
  // covers the card or the button.
  const { panes, paddingLeft, paddingRight, width } = useLayout()
  const bar = panes ? detailsPaneBar(width, paddingLeft, paddingRight, isRtl) : { paddingLeft, paddingRight }
  const { offerId } = useLocalSearchParams<{ offerId: string }>()
  const { user } = useAuth()
  const { isWishlisted, toggleWishlist } = useWishlist()
  // The tapped card's data first (if any); undefined while loading, null when missing.
  const [offer, setOffer] = useState<OfferDocument | null | undefined>(() => (offerId ? cachedOffer(offerId) : undefined))
  const [claimed, setClaimed] = useState<boolean | null>(null)
  // Read once per mount, since render must stay pure.
  const [now] = useState(Date.now)

  useEffect(() => {
    if (!offerId) return
    let cancelled = false
    getOffer(offerId)
      .then((next) => {
        if (!cancelled) setOffer(next)
      })
      .catch(() => {
        // Keep the card's data if there is any; otherwise show "not found".
        if (!cancelled) setOffer((current) => current ?? null)
      })
    return () => {
      cancelled = true
    }
  }, [offerId])

  const uid = user?.uid
  // A failed read leaves Buy available; checkout itself refuses a second claim.
  const fetchClaimed = useCallback(
    () => (uid && offerId ? hasUserClaimedOffer(uid, offerId).catch(() => false) : Promise.resolve(false)),
    [uid, offerId]
  )

  useFocusEffect(
    useCallback(() => {
      let cancelled = false
      fetchClaimed().then((next) => {
        if (!cancelled) setClaimed(next)
      })
      return () => {
        cancelled = true
      }
    }, [fetchClaimed])
  )

  const buy = () => {
    if (offer) router.push({ pathname: '/checkout/[offerId]', params: { offerId: offer.id } })
  }

  const discount = offer ? getOfferDiscountPercent(offer.originalPrice, offer.offerPrice) : 0
  const tile = offer ? CATEGORY_TILES.find((c) => c.category === offer.category) : undefined
  const saved = offer ? isWishlisted(offer.id) : false
  const remaining = offer && offer.totalQuantity !== null ? Math.max(offer.totalQuantity - offer.claimedCount, 0) : null
  const expired = !!offer?.expiryDate && offer.expiryDate.getTime() < now
  // The admin's text in the reader's language, with "Show original" (web: the perk page).
  const content = useLocalizedContent(offerTextSources(offer), offer?.translations, lang)
  // The business name has its own translations; one "Show original" switch flips both.
  const nameContent = useLocalizedContent({ businessName: offer?.businessName ?? '' }, offer?.businessTranslations, lang)
  const businessName = nameContent.text('businessName')
  const image = useDealImage(offer?.imageUrl ?? '')
  const machine = content.machine || nameContent.machine
  const showingOriginal = content.showingOriginal || nameContent.showingOriginal
  const toggleOriginal = () => {
    content.toggleOriginal()
    nameContent.toggleOriginal()
  }
  const title = content.text('title')
  const description = content.text('description')
  const instructions = content.text('redemptionInstructions')
  const terms = content.text('redemptionTerms')
  // The full address as Google writes it in the reader's language.
  const place = offer ? offerFullAddress(offer, lang) : ''

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Held landscape, the header steps in from a side cutout like the content below it. */}
      <View style={{ paddingLeft: insets.left, paddingRight: insets.right }}>
        <ScreenHeader title={businessName.text} fallback="/perks" />
      </View>
      {offer === undefined ? (
        <ActivityIndicator color={colors.brand} style={styles.spinner} />
      ) : offer === null ? (
        <View style={styles.notFound}>
          <AppText style={styles.notFoundTitle}>{t('offer_detail_not_found_title')}</AppText>
          <AppText style={styles.notFoundSub}>{t('offer_detail_not_found_sub')}</AppText>
        </View>
      ) : (
        <>
          <ScrollView showsVerticalScrollIndicator={false} showsHorizontalScrollIndicator={false} contentContainerStyle={[styles.content, { paddingLeft, paddingRight }]} contentInsetAdjustmentBehavior="automatic">
            <View style={[styles.card, panes && styles.cardPanes]}>
              {/* Not clipped, so the logo circle can hang over the picture's foot. */}
              <View style={[styles.heroWrap, panes && styles.heroPane]}>
                {/* The framed picture, as the perk card draws it: a photo fades in over the category's panel;
                    an offer image that is a logo goes to the circle instead. */}
                <View style={[styles.hero, panes && styles.heroTall]}>
                  <CategoryPanel category={offer.category} size="hero" />
                  {(image.role === 'pending' || image.role === 'photo') && (
                    <Animated.View style={[StyleSheet.absoluteFill, image.photoStyle]}>
                      <Image source={{ uri: image.uri }} style={styles.fill} resizeMode="cover" resizeMethod="scale" onError={image.onError} onLoad={image.onLoad} accessibilityIgnoresInvertColors />
                    </Animated.View>
                  )}
                  {/* Floats over the picture's top end corner; glass on iOS. */}
                  <GlassHeartButton
                    saved={saved}
                    onToggle={() => toggleWishlist(offer.id)}
                    label={saved ? t('btn_remove_from_wishlist') : t('btn_add_to_wishlist')}
                    style={styles.heart}
                  />
                </View>
                <MerchantBadge
                  logoUri={badgeLogoUri(secureImageUrl(offer.businessLogoUrl ?? ''), image.uri, image.role)}
                  initial={businessInitial(businessName.text)}
                  size={DETAIL_BADGE}
                  style={styles.badge}
                />
              </View>

              <View style={[styles.body, panes && styles.bodyPane]}>
                {/* One inline row of text-only pills. In one column it sits beside the
                    badge's lower half, where the category gives way (truncates) so the
                    redemption method never drops under it; in two panes it can wrap. */}
                <View style={[styles.chips, !panes && styles.chipsBesideBadge]}>
                  <View style={[styles.chip, styles.categoryChip]}>
                    <AppText style={[styles.chipText, styles.categoryText]} numberOfLines={1}>
                      {tile ? t(tile.labelKey) : offer.category}
                    </AppText>
                  </View>
                  <View style={[styles.chip, styles.methodChip]}>
                    <AppText style={[styles.chipText, styles.methodText]} numberOfLines={1}>
                      {t(REDEMPTION_METHOD_LABEL_KEYS[offer.redemptionMethod])}
                    </AppText>
                  </View>
                </View>

                <AppText style={styles.business}>{businessName.text}</AppText>
                <ContentText contentLang={title.lang} style={styles.title} accessibilityRole="header">{title.text}</ContentText>
                {!!place && (
                  <View style={styles.location}>
                    <LineIcon name="pin" size={14} color={colors.textFaint} strokeWidth={2} />
                    <AppText style={styles.locationText}>{place}</AppText>
                  </View>
                )}
                <NavigationButtons destination={{ geo: offer.geo, placeId: offer.address?.placeId, address: place || offer.location }} />

                <View style={styles.priceRow}>
                  <AppText ltr style={styles.price}>{formatPrice(offer.offerPrice)}</AppText>
                  {discount > 0 && <AppText ltr style={styles.original}>{formatPrice(offer.originalPrice)}</AppText>}
                  {/* In the price row, never over the picture. */}
                  {discount > 0 && (
                    <View style={styles.discount}>
                      <AppText style={styles.discountText}>{t('offer_percent_off').replace('{n}', String(discount))}</AppText>
                    </View>
                  )}
                </View>

                {!!description.text && <ContentText contentLang={description.lang} style={styles.description}>{description.text}</ContentText>}
                {machine && <TranslationNotice showingOriginal={showingOriginal} onToggle={toggleOriginal} />}

                {(offer.expiryDate || remaining !== null) && (
                  <View style={styles.facts}>
                    {offer.expiryDate && (
                      <View style={styles.fact}>
                        <LineIcon name="calendar" size={14} color={colors.textFaint} strokeWidth={2} />
                        <AppText style={[styles.factText, expired && styles.expired]}>
                          {t('offer_detail_expires').replace('{date}', formatLongDate(offer.expiryDate, lang))}
                        </AppText>
                      </View>
                    )}
                    {remaining !== null && (
                      <View style={styles.fact}>
                        <LineIcon name="tag" size={14} color={colors.textFaint} strokeWidth={2} />
                        <AppText style={styles.factText}>{t('offer_detail_remaining').replace('{count}', String(remaining))}</AppText>
                      </View>
                    )}
                  </View>
                )}

                <View style={styles.divider} />
                <AppText style={styles.howTitle} accessibilityRole="header">{t('redeem_how_title')}</AppText>
                {redemptionSteps(offer.redemptionMethod, instructions.text, t).map((step, i) => (
                  <View key={i} style={styles.step} accessibilityLabel={`${i + 1}. ${step}`} accessible>
                    <View style={styles.stepNumber}>
                      <AppText ltr style={styles.stepNumberText}>{i + 1}</AppText>
                    </View>
                    {/* The merchant's own steps are in the content's language; the standard ones in the app's. */}
                    <ContentText contentLang={instructions.text.trim() ? instructions.lang : null} style={styles.stepText}>{step}</ContentText>
                  </View>
                ))}
                {!!terms.text && (
                  <>
                    <AppText style={styles.termsLabel} accessibilityRole="header">{t('voucher_redemption_terms_label')}</AppText>
                    <ContentText contentLang={terms.lang} style={styles.terms}>{terms.text}</ContentText>
                  </>
                )}
              </View>
            </View>
          </ScrollView>

          {/* Pinned above the home indicator, outside the scroll. */}
          <View style={[styles.actionBar, { paddingBottom: Math.max(insets.bottom, 12), ...bar }]}>
            {claimed ? (
              <View style={styles.claimed} accessibilityLiveRegion="polite">
                <LineIcon name="check" size={20} color={colors.success} strokeWidth={2.4} />
                <AppText style={styles.claimedTitle}>{t('offer_already_claimed_title')}</AppText>
                <Pressable
                  accessibilityRole="link"
                  onPress={() => router.navigate('/wallet')}
                  hitSlop={8}
                  style={styles.claimedLink}
                >
                  <AppText style={styles.claimedLinkText}>{t('home_pass_cta')}</AppText>
                </Pressable>
              </View>
            ) : (
              <Button
                label={t('offer_buy_button').replace('{price}', formatPrice(offer.offerPrice))}
                onPress={buy}
                busy={claimed === null}
                disabled={expired}
                large
              />
            )}
          </View>
        </>
      )}
    </SafeAreaView>
  )
}

/** The two-pane card's widest (web: max-w-4xl). */
const PANES_MAX_WIDTH = 896
/** The details pane's inner padding (styles.body). */
const BODY_PADDING = 20
/** The picture's inset from the card's edges (styles.heroWrap). */
const HERO_INSET = 12
/** The business's logo circle: a little larger than the cards' 56pt, as the picture is, and how far in from the picture's start edge it hangs. */
const DETAIL_BADGE = 64
const DETAIL_BADGE_INSET = 16

/**
 * The buy bar's side padding in two panes, so the button spans exactly the
 * details pane's text column: the card is centred between the side paddings
 * and capped, and the details take its trailing half (the left in Hebrew).
 */
function detailsPaneBar(width: number, paddingLeft: number, paddingRight: number, isRtl: boolean) {
  const row = width - paddingLeft - paddingRight
  const card = Math.min(row, PANES_MAX_WIDTH)
  const cardLeft = paddingLeft + (row - card) / 2
  const cardRight = width - cardLeft - card
  return isRtl
    ? { paddingLeft: cardLeft + BODY_PADDING, paddingRight: cardRight + card / 2 + BODY_PADDING }
    : { paddingLeft: cardLeft + card / 2 + BODY_PADDING, paddingRight: cardRight + BODY_PADDING }
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  spinner: { marginTop: 48 },
  notFound: { alignItems: 'center', marginTop: 48, paddingHorizontal: 24 },
  notFoundTitle: { fontSize: 17, fontWeight: '700', color: colors.heading, textAlign: 'center', marginBottom: 4 },
  notFoundSub: { fontSize: 14, color: colors.body, textAlign: 'center' },
  content: { paddingHorizontal: 16, paddingTop: 4, paddingBottom: 24 },
  card: { backgroundColor: colors.white, borderRadius: 24, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' },
  // Inset from the card's edges in its own snug frame: light canvas, hairline border, 14pt corners.
  heroWrap: { marginHorizontal: HERO_INSET, marginTop: HERO_INSET, zIndex: 1 },
  hero: {
    height: 180,
    borderRadius: radius.frame,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    backgroundColor: colors.background,
  },
  // Web: components/discover/DiscountBadge.tsx (solid emerald-700, white text).
  discount: { alignSelf: 'center', backgroundColor: colors.discount, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 5 },
  discountText: { fontSize: 13, fontWeight: '800', color: colors.white, letterSpacing: 0.5, textTransform: 'uppercase' },
  fill: { width: '100%', height: '100%' },
  heart: { position: 'absolute', top: 6, end: 6 },
  // Half over the picture's foot at its start edge, so it mirrors in Hebrew.
  badge: { position: 'absolute', start: DETAIL_BADGE_INSET, bottom: -DETAIL_BADGE / 2 },
  body: { padding: BODY_PADDING },
  // Two panes: a row (it follows the root view's direction), no wider than the
  // website's offer page (max-w-4xl), the picture taller and kept clear of the
  // fold by half the pane gap, the details taking the other half.
  cardPanes: { flexDirection: 'row', alignItems: 'flex-start', width: '100%', maxWidth: PANES_MAX_WIDTH, alignSelf: 'center' },
  // The pane keeps the circle's hanging half inside the card.
  heroPane: { flex: 1, marginEnd: PANE_GAP / 2, marginBottom: HERO_INSET + DETAIL_BADGE / 2 },
  heroTall: { height: 260 },
  bodyPane: { flex: 1, minWidth: 0 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
  // Clear of the badge: its start edge and width, plus 8pt, less the body's own padding.
  // One line there: the category truncates instead of pushing the method under it.
  chipsBesideBadge: { flexWrap: 'nowrap', marginStart: HERO_INSET + DETAIL_BADGE_INSET + DETAIL_BADGE + 8 - BODY_PADDING },
  // Both pills share one shape: compact, fully rounded, text only.
  chip: { flexDirection: 'row', alignItems: 'center', borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 4 },
  chipText: { fontSize: 12, lineHeight: 16, fontWeight: '600' },
  categoryChip: { flexShrink: 1, minWidth: 0, backgroundColor: colors.brandTint },
  categoryText: { flexShrink: 1, color: colors.brand },
  methodChip: { flexShrink: 0, backgroundColor: colors.borderLight },
  methodText: { color: colors.body },
  business: { fontSize: 26, lineHeight: 32, fontWeight: '800', color: colors.heading, marginTop: 16 },
  title: { fontSize: 17, lineHeight: 24, fontWeight: '600', color: colors.text, marginTop: 6 },
  location: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, marginTop: 8 },
  locationText: { flex: 1, fontSize: 14, color: colors.textFaint },
  priceRow: { flexDirection: 'row', alignItems: 'baseline', flexWrap: 'wrap', gap: 10, marginTop: 16 },
  price: { fontSize: 28, fontWeight: '800', color: colors.brand },
  original: { fontSize: 17, color: colors.textFaint, textDecorationLine: 'line-through' },
  description: { fontSize: 15, lineHeight: 23, color: colors.body, marginTop: 16 },
  facts: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 20, rowGap: 8, marginTop: 16 },
  fact: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  factText: { fontSize: 13, fontWeight: '500', color: colors.body },
  expired: { color: colors.danger },
  divider: { height: 1, backgroundColor: colors.borderLight, marginVertical: 20 },
  howTitle: { fontSize: 14, fontWeight: '700', color: colors.heading, marginBottom: 12 },
  step: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 10 },
  stepNumber: { width: 22, height: 22, borderRadius: radius.pill, backgroundColor: colors.brand, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  stepNumberText: { fontSize: 11, fontWeight: '700', color: colors.white, textAlign: 'center' },
  stepText: { flex: 1, fontSize: 13, lineHeight: 19, color: colors.body },
  termsLabel: { fontSize: 12, fontWeight: '700', color: colors.textStrong, marginTop: 12, marginBottom: 4 },
  terms: { fontSize: 13, lineHeight: 19, color: colors.textMuted },
  actionBar: {
    paddingHorizontal: 16,
    paddingTop: 12,
    backgroundColor: colors.white,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
  },
  claimed: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8, minHeight: 52 },
  claimedTitle: { flex: 1, fontSize: 15, fontWeight: '700', color: colors.heading },
  claimedLink: { minHeight: 44, justifyContent: 'center', ...webOnly({ cursor: 'pointer' }) },
  claimedLinkText: { fontSize: 15, fontWeight: '700', color: colors.brand },
})

import { useCallback, useEffect, useState } from 'react'
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native'
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
import { getOffer, getOfferDiscountPercent, type OfferDocument } from '@shared/firebase/offers'
import { hasUserClaimedOffer } from '@shared/firebase/vouchers'
import { useAuth } from '@shared/firebase/useAuth'
import { useWishlist } from '@shared/firebase/useWishlist'
import { formatLongDate, formatPrice } from '@shared/format'
import { redemptionSteps } from '@shared/offers/redemption'
import { useLocalizedContent } from '@shared/i18n/useLocalizedContent'
import { navigationLinks } from '@shared/maps/navigation'
import { distinctDescription, offerTextSources } from '@shared/offers/offerText'
import { offerFullAddress } from '@shared/geo'
import { isMultiChain, ParticipatingChains, PerkReachLine } from '../../components/PerkReach'
import Accordion from '../../components/Accordion'
import AppText from '../../components/AppText'
import ContentText from '../../components/ContentText'
import DealMedia from '../../components/DealMedia'
import TranslationNotice from '../../components/TranslationNotice'
import Button from '../../components/Button'
import LineIcon from '../../components/LineIcon'
import GlassBackButton from '../../components/GlassBackButton'
import GlassHeartButton from '../../components/GlassHeartButton'
import MerchantBadge from '../../components/MerchantBadge'
import OfferTags from '../../components/OfferTags'
import NavigationButtons from '../../components/NavigationButtons'
import ScreenHeader, { goBack } from '../../components/ScreenHeader'
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
// direction turns it back, the same as the back button. The same 16:9 picture
// as the perk cards (DealMedia.tsx), edge to edge on a phone with the back
// button and wishlist heart over it and the content rising over its foot as a
// sheet, the business's logo floating on that edge. Then its name and the offer
// as the heading, the price with what it saves, the address with the ways to get
// there, the facts as pills and the about, how-to-redeem and fine print folds;
// the Buy button sits in a bar
// pinned above the home indicator. Buy pushes the native checkout
// (app/checkout/[offerId].tsx); a finished purchase replaces it with the new
// voucher, so coming back here re-runs the claim check on focus, turning the
// Buy bar into the "already claimed" notice.
export default function OfferScreen() {
  const { t, lang, isRtl } = useLang()
  const insets = useSafeAreaInsets()
  // Unfolded (600pt and up; src/lib/layout.ts): no card, the picture and the
  // details side by side on the canvas, either side of the fold, in the reading
  // direction (the picture on the right in Hebrew), and the buy button under the
  // details pane; from 1024pt the picture takes the larger share (web: lg). Folding back re-lays it out as the one phone column. The side
  // padding carries the safe-area insets, so a landscape camera cutout never
  // covers the card or the button.
  const { panes, paddingLeft, paddingRight, width } = useLayout()
  const heroShare = width >= WIDE_WIDTH ? WIDE_HERO_SHARE : 1
  const bar = panes ? detailsPaneBar(width, paddingLeft, paddingRight, isRtl, heroShare) : { paddingLeft, paddingRight }
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
  const descriptionText = distinctDescription(title.text, description.text)
  const instructions = content.text('redemptionInstructions')
  const terms = content.text('redemptionTerms')
  // The full address as Google writes it in the reader's language.
  const place = offer ? offerFullAddress(offer, lang) : ''
  const multiChain = !!offer && isMultiChain(offer)
  const destination = offer ? { geo: offer.geo, placeId: offer.address?.placeId, address: place || offer.location } : null
  const logo = offer && (
    <MerchantBadge
      logoUri={badgeLogoUri(secureImageUrl(offer.businessLogoUrl ?? ''), image.uri, image.role)}
      initial={businessInitial(businessName.text)}
      height={panes ? 64 : 56}
      large
      style={panes ? styles.logoPane : styles.logo}
    />
  )

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Held landscape, the header steps in from a side cutout like the content below it. */}
      <View style={{ paddingLeft: insets.left, paddingRight: insets.right }}>
        {/* On a phone a found offer floats its back button over the picture. */}
        {(panes || !offer) && <ScreenHeader fallback="/perks" />}
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
          <ScrollView showsVerticalScrollIndicator={false} showsHorizontalScrollIndicator={false} contentContainerStyle={panes ? [styles.content, { paddingLeft, paddingRight }] : undefined} contentInsetAdjustmentBehavior="automatic">
            <View style={panes ? styles.cardPanes : undefined}>
              <View style={[styles.heroWrap, panes && styles.heroPane, panes && { flex: heroShare }]}>
                {/* The same picture as the perk card: an offer image that is a logo goes to the badge instead. */}
                <DealMedia image={image} category={offer.category} corners={panes ? 'all' : 'none'}>
                  {!panes && (
                    <View style={styles.back}>
                      <GlassBackButton label={t('settings_back')} onPress={() => goBack('/perks')} />
                    </View>
                  )}
                  {discount > 0 && (
                    <View style={[styles.ribbon, panes && styles.ribbonPane]}>
                      <AppText ltr accessibilityLabel={t('offer_percent_off').replace('{n}', String(discount))} style={styles.ribbonText}>{`-${discount}%`}</AppText>
                    </View>
                  )}
                  {/* At the picture's foot, clear of the ribbon and of the sheet rising over it on a phone; glass on iOS. */}
                  <GlassHeartButton
                    saved={saved}
                    onToggle={() => toggleWishlist(offer.id)}
                    label={saved ? t('btn_remove_from_wishlist') : t('btn_add_to_wishlist')}
                    style={panes ? styles.heartPane : styles.heart}
                  />
                  {panes && logo}
                </DealMedia>
              </View>

              <View style={panes ? [styles.body, styles.bodyPane] : [styles.body, styles.sheet]}>
                {!panes && logo}
                <OfferTags category={offer.category} method={offer.redemptionMethod} />
                <AppText style={[styles.business, styles.businessAfterTags]}>{businessName.text}</AppText>
                <ContentText contentLang={title.lang} style={styles.title} accessibilityRole="header">{title.text}</ContentText>

                <View style={styles.priceRow}>
                  <AppText ltr style={styles.price}>{formatPrice(offer.offerPrice)}</AppText>
                  {discount > 0 && <AppText ltr style={styles.original}>{formatPrice(offer.originalPrice)}</AppText>}
                  {discount > 0 && <AppText style={styles.saving}>{t('offer_you_save').replace('{amount}', formatPrice(offer.originalPrice - offer.offerPrice))}</AppText>}
                </View>

                {/* Text-only pills of what the offer really states; they wrap. */}
                {(!!offer.expiryDate || remaining !== null) && (
                  <View style={styles.chips}>
                    {offer.expiryDate && (
                      <View style={[styles.chip, expired ? styles.expiredChip : styles.methodChip]}>
                        <AppText style={[styles.chipText, expired ? styles.expired : styles.methodText]} numberOfLines={1}>
                          {t('offer_detail_expires').replace('{date}', formatLongDate(offer.expiryDate, lang))}
                        </AppText>
                      </View>
                    )}
                    {remaining !== null && (
                      <View style={[styles.chip, styles.methodChip]}>
                        <AppText style={[styles.chipText, styles.methodText]} numberOfLines={1}>{t('offer_detail_remaining').replace('{count}', String(remaining))}</AppText>
                      </View>
                    )}
                  </View>
                )}

                {machine && <TranslationNotice showingOriginal={showingOriginal} onToggle={toggleOriginal} />}

                {/* The header's last row, right above the folds: the address, with the ways to get there at its end. */}
                {(multiChain || (offer.fulfillmentType === 'multipass_pool' && !place)) && (
                  <View style={styles.location}>
                    <PerkReachLine offer={offer} hasPlace={!!place} />
                  </View>
                )}
                {!multiChain && !(offer.fulfillmentType === 'multipass_pool' && !place) && (!!place || (destination && !!navigationLinks(destination))) && (
                  <View style={styles.location}>
                    {!!place && (
                      <View style={styles.address}>
                        <LineIcon name="pin" size={14} color={colors.textFaint} strokeWidth={2} />
                        <AppText style={styles.locationText}>{place}</AppText>
                      </View>
                    )}
                    {destination && <NavigationButtons destination={destination} />}
                  </View>
                )}

                <View style={styles.folds}>
                  {multiChain && (
                    <Accordion title={t('perk_chains_title')} defaultOpen>
                      <ParticipatingChains offer={offer} />
                    </Accordion>
                  )}
                  {!!descriptionText && (
                    <Accordion title={t('offer_about_title')} defaultOpen>
                      <ContentText contentLang={description.lang} style={styles.description}>{descriptionText}</ContentText>
                    </Accordion>
                  )}
                  <Accordion title={t('offer_how_title')} defaultOpen>
                    {(() => {
                      const steps = redemptionSteps(offer.redemptionMethod, instructions.text, t)
                      // Numbers only for the merchant's own multi-line instructions, where order matters.
                      const numbered = instructions.text.trim() !== '' && steps.length > 1
                      return steps.map((step, i) => (
                      <View key={i} style={styles.step} accessibilityLabel={numbered ? `${i + 1}. ${step}` : step} accessible>
                        {numbered && (
                          <View style={styles.stepNumber}>
                            <AppText ltr style={styles.stepNumberText}>{i + 1}</AppText>
                          </View>
                        )}
                        {/* The merchant's own steps are in the content's language; the standard ones in the app's. */}
                        <ContentText contentLang={instructions.text.trim() ? instructions.lang : null} style={styles.stepText}>{step}</ContentText>
                      </View>
                    ))
                    })()}
                  </Accordion>
                  {!!terms.text && (
                    <Accordion title={t('offer_fine_print_title')}>
                      <ContentText contentLang={terms.lang} style={styles.terms}>{terms.text}</ContentText>
                    </Accordion>
                  )}
                </View>
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

/** The two panes' widest (web: max-w-6xl inside px-6). */
const PANES_MAX_WIDTH = 1104
/** The details pane's inner padding on a phone (styles.body). */
const BODY_PADDING = 20
/** From this width the picture takes WIDE_HERO_SHARE parts to the details' one (web: lg:grid-cols-[1.6fr_1fr]). */
const WIDE_WIDTH = 1024
const WIDE_HERO_SHARE = 1.6

/**
 * The buy bar's side padding in two panes, so the button spans exactly the
 * details pane: the panes are centred between the side paddings and capped, and
 * the details take the trailing share (the left in Hebrew).
 */
function detailsPaneBar(width: number, paddingLeft: number, paddingRight: number, isRtl: boolean, heroShare: number) {
  const row = width - paddingLeft - paddingRight
  const stage = Math.min(row, PANES_MAX_WIDTH)
  const stageLeft = paddingLeft + (row - stage) / 2
  const stageRight = width - stageLeft - stage
  const leading = stage - (stage - PANE_GAP) / (heroShare + 1)
  return isRtl ? { paddingLeft: stageLeft, paddingRight: stageRight + leading } : { paddingLeft: stageLeft + leading, paddingRight: stageRight }
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  spinner: { marginTop: 48 },
  notFound: { alignItems: 'center', marginTop: 48, paddingHorizontal: 24 },
  notFoundTitle: { fontSize: 17, fontWeight: '700', color: colors.heading, textAlign: 'center', marginBottom: 4 },
  notFoundSub: { fontSize: 14, color: colors.body, textAlign: 'center' },
  content: { paddingHorizontal: 16, paddingTop: 4, paddingBottom: 24 },
  heroWrap: { zIndex: 1 },
  // Web: components/discover/DiscountBadge.tsx (solid emerald-700, white text), tied to the picture's top end corner.
  ribbon: {
    position: 'absolute',
    top: 0,
    end: 0,
    backgroundColor: colors.discountBadge,
    borderBottomStartRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 4,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  ribbonPane: { borderTopEndRadius: radius.lg },
  ribbonText: { fontSize: 14, lineHeight: 20, fontWeight: '700', color: colors.white },
  heart: { position: 'absolute', bottom: 26, end: 6 },
  heartPane: { position: 'absolute', bottom: 6, end: 6 },
  back: { position: 'absolute', top: 6, start: 6 },
  body: { padding: BODY_PADDING },
  // A phone's content, rising over the picture's foot, its shadow falling upward; its top padding clears the logo.
  sheet: {
    zIndex: 2,
    marginTop: -20,
    paddingTop: 44,
    borderTopStartRadius: 24,
    borderTopEndRadius: 24,
    backgroundColor: colors.white,
    shadowColor: colors.textStrong,
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 8,
  },
  // Two panes: a row (it follows the root view's direction), no wider than the
  // website's offer page, with no card around it, the pane gap between the two.
  cardPanes: { flexDirection: 'row', alignItems: 'flex-start', width: '100%', maxWidth: PANES_MAX_WIDTH, alignSelf: 'center' },
  heroPane: {
    marginEnd: PANE_GAP,
    borderRadius: radius.lg,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 15,
    elevation: 4,
  },
  bodyPane: { flex: 1, minWidth: 0, padding: 0 },
  // On the sheet's edge on a phone; in the picture's bottom start corner in two panes.
  logo: { position: 'absolute', top: -28, start: BODY_PADDING },
  logoPane: { position: 'absolute', bottom: 16, start: 16 },
  chips: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginTop: 14 },
  // The pills share one shape: compact, fully rounded, text only.
  chip: { flexDirection: 'row', alignItems: 'center', borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 4 },
  chipText: { fontSize: 12, lineHeight: 16, fontWeight: '600' },
  methodChip: { flexShrink: 0, backgroundColor: colors.borderLight },
  methodText: { color: colors.body },
  business: { fontSize: 16, lineHeight: 22, fontWeight: '700', color: colors.body },
  businessAfterTags: { marginTop: 8 },
  title: { fontSize: 24, lineHeight: 30, fontWeight: '800', color: colors.heading, marginTop: 4 },
  location: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 14 },
  address: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'flex-start', gap: 6 },
  locationText: { flex: 1, fontSize: 14, color: colors.textFaint },
  priceRow: { flexDirection: 'row', alignItems: 'baseline', flexWrap: 'wrap', gap: 10, marginTop: 16 },
  price: { fontSize: 28, fontWeight: '800', color: colors.brand },
  original: { fontSize: 17, color: colors.textFaint, textDecorationLine: 'line-through' },
  // Web: text-emerald-700.
  saving: { fontSize: 14, fontWeight: '600', color: colors.discount },
  description: { fontSize: 15, lineHeight: 23, color: colors.body },
  expiredChip: { backgroundColor: '#FEF2F2' },
  expired: { color: colors.danger },
  folds: { marginTop: 20 },
  step: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 10 },
  stepNumber: { width: 22, height: 22, borderRadius: radius.pill, backgroundColor: colors.brandLight, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  stepNumberText: { fontSize: 11, fontWeight: '700', color: colors.brand, textAlign: 'center' },
  stepText: { flex: 1, fontSize: 13, lineHeight: 19, color: colors.body },
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

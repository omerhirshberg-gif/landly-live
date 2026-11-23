import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native'
import Animated, { useAnimatedScrollHandler, useAnimatedStyle, useReducedMotion, useSharedValue } from 'react-native-reanimated'
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
import { getOffer, getOfferDiscountPercent, isOfferAvailable, type OfferDocument } from '@shared/firebase/offers'
import { getClaimedPoolIds } from '@shared/firebase/vouchers'
import { variantDiscountPercent } from '@shared/offers/variants'
import { useChainBrands } from '@shared/offers/useChainBrands'
import { useOffers } from '@shared/offers/useOffers'
import { isRaayonitMultiChain } from '@shared/offers/multiChainNote'
import { useAuth } from '@shared/firebase/useAuth'
import { useWishlist } from '@shared/firebase/useWishlist'
import { formatLongDate, formatPrice } from '@shared/format'
import { redemptionSteps } from '@shared/offers/redemption'
import { isolateNumbers } from '@shared/inventory/raayonitRedemption'
import { useLocalizedContent } from '@shared/i18n/useLocalizedContent'
import { navigationLinks } from '@shared/maps/navigation'
import { distinctDescription, offerTextSources } from '@shared/offers/offerText'
import { offerFullAddress } from '@shared/geo'
import { isSingleVenue, locationNoticeKind, shouldShowLocationNavigation } from '@shared/offers/locationVisibility'
import { ParticipatingChains, PerkReachLine, RedemptionGuide } from '../../components/PerkReach'
import IssuerAttribution from '../../components/IssuerAttribution'
import { isPooled } from '@shared/inventory/types'
import { RAAYONIT_ISSUER } from '@shared/payments/issuer'
import Accordion from '../../components/Accordion'
import AppText from '../../components/AppText'
import ContentText from '../../components/ContentText'
import DealMedia from '../../components/DealMedia'
import VariantSelector from '../../components/VariantSelector'
import TranslationNotice from '../../components/TranslationNotice'
import Button from '../../components/Button'
import LineIcon from '../../components/LineIcon'
import GlassBackButton from '../../components/GlassBackButton'
import GlassHeartButton from '../../components/GlassHeartButton'
import MerchantBadge from '../../components/MerchantBadge'
import OfferTags from '../../components/OfferTags'
import FlagshipEyebrow from '../../components/FlagshipEyebrow'
import NavigationButtons from '../../components/NavigationButtons'
import ScreenHeader, { goBack } from '../../components/ScreenHeader'
import { useLang } from '../../i18n/LangProvider'
import { PANE_GAP } from '../../lib/layout'
import BrandStrip from '../../components/BrandStrip'
import { isChain, isFlagship, landlyOffers } from '@shared/offers/discoverTab'
import RaayonitChainNotes from '../../components/RaayonitChainNotes'
import BranchStrip from '../../components/BranchStrip'
import RedemptionCallout from '../../components/RedemptionCallout'
import { isolateLtr, variantForDenomination } from '@shared/home/superShowcase'
import { heroLogoIsFallback, heroLogoSource, isRaayonitOffer, raayonitImageOpts } from '../../lib/logoHero'
import { badgeLogoUri, secureImageUrl } from '../../lib/imageSource'
import { cachedOffer, openOffer } from '../../lib/openOffer'
import OfferCarousel from '../../components/OfferCarousel'
import { superTavHeadline } from '@shared/offers/superTav'
import SectionHeader from '../../components/SectionHeader'
import BrandSpotlight from '../../components/BrandSpotlight'
import ChainOfferView from '../../components/ChainOfferView'
import { ChainsAccordion, MultiChainBonus } from '../../components/MultiChainCredit'
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
// A render error here shows the retry card; the rest of the app stays up.
export { default as ErrorBoundary } from '../../components/RouteErrorBoundary'

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
  const { offerId, denomination } = useLocalSearchParams<{ offerId: string; denomination?: string }>()
  const { user } = useAuth()
  const { isWishlisted, toggleWishlist } = useWishlist()
  // The tapped card's data first (if any); undefined while loading, null when missing.
  const [offer, setOffer] = useState<OfferDocument | null | undefined>(() => (offerId ? cachedOffer(offerId) : undefined))
  const [claimed, setClaimed] = useState<boolean | null>(null)
  // The hero stretches when the sheet is pulled down past the top (iOS rubber-band), and trails the scroll a little going up.
  // Android and the web build have no overscroll offset to follow, so they only get the trailing motion.
  const scrollY = useSharedValue(0)
  const heroHeight = useSharedValue(0)
  const reducedMotion = useReducedMotion()
  const onScroll = useAnimatedScrollHandler((e) => { scrollY.set(e.contentOffset.y) })
  const heroStyle = useAnimatedStyle(() => {
    if (reducedMotion) return {}
    const y = scrollY.get()
    const h = Math.max(heroHeight.get(), 1)
    if (y < 0) return { transformOrigin: 'bottom', transform: [{ scale: 1 + Math.min(-y, h) / h }] }
    return { transform: [{ translateY: y * 0.35 }] }
  })
  const scroller = useRef<Animated.ScrollView>(null)
  const chainsAt = useRef<View>(null)
  // "See the chains": scrolls to the participating-chains fold and opens it.
  const [chainsOpen, setChainsOpen] = useState(false)
  const seeChains = () => {
    setChainsOpen(true)
    const target = chainsAt.current
    const list = scroller.current
    if (target && list) target.measureLayout(list as unknown as number, (_x, y) => (list as unknown as { scrollTo: (o: { y: number; animated: boolean }) => void }).scrollTo({ y: Math.max(0, y - 80), animated: true }), () => {})
  }
  // A multi-denomination offer: the voucher value picked (a pool id); empty = the first one that isn't already owned.
  const [pickedChoice, setPickedPool] = useState('')
  const [claimedPools, setClaimedPools] = useState<string[]>([])
  // Read once per mount, since render must stay pure.
  const [now] = useState(Date.now)
  // A showcase card opens this screen with its value (denomination=150): that value starts out picked.
  const denominationPool = offer?.variants?.length ? variantForDenomination(offer.variants, denomination)?.poolId ?? '' : ''
  const pickedPool = pickedChoice || denominationPool

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

  // The Raayonit Card has no offer screen of its own: it is bought from the hub (and Home) in one tap. A direct link lands there.
  const flagshipHere = !!offer && isFlagship(offer)
  useEffect(() => {
    if (flagshipHere) router.replace('/raayonit')
  }, [flagshipHere])

  const uid = user?.uid
  // A voucher from before variants belongs to the offer's default (first, cheapest) stock.
  const defaultPoolId = offer?.variants?.[0]?.poolId ?? null
  // A failed read leaves Buy available; checkout itself refuses a second claim.
  const fetchClaimed = useCallback(
    () => (uid && offerId ? getClaimedPoolIds(uid, offerId, defaultPoolId).catch(() => ({ any: false, pools: [] as string[] })) : Promise.resolve({ any: false, pools: [] as string[] })),
    [uid, offerId, defaultPoolId]
  )

  useFocusEffect(
    useCallback(() => {
      let cancelled = false
      fetchClaimed().then((next) => {
        if (cancelled) return
        setClaimed(next.any)
        setClaimedPools(next.pools)
      })
      return () => {
        cancelled = true
      }
    }, [fetchClaimed])
  )

  // Multi-denomination: the picked value, else the first one not already owned; the price, saving and checkout follow it.
  const variants = offer?.variants ?? []
  const multi = variants.length > 1
  const freeVariants = variants.filter((v) => !claimedPools.includes(v.poolId))
  const selected = variants.length > 0 ? (freeVariants.find((v) => v.poolId === pickedPool) ?? freeVariants[0] ?? variants[0]) : undefined
  const price = selected ? selected.priceAgorot / 100 : offer?.offerPrice ?? 0
  const original = selected ? selected.faceValueAgorot / 100 : offer?.originalPrice ?? 0
  const everyValueOwned = variants.length > 0 && freeVariants.length === 0
  const buy = () => {
    if (offer) router.push({ pathname: '/checkout/[offerId]', params: { offerId: offer.id, ...(selected ? { variant: selected.poolId } : {}) } })
  }

  const discount = offer ? (selected ? variantDiscountPercent(selected) : getOfferDiscountPercent(offer.originalPrice, offer.offerPrice)) : 0
  const saved = offer ? isWishlisted(offer.id) : false
  const remaining = offer && offer.totalQuantity !== null ? Math.max(offer.totalQuantity - offer.claimedCount, 0) : null
  const expired = !!offer?.expiryDate && offer.expiryDate.getTime() < now
  // The admin's text in the reader's language, with "Show original" (web: the perk page).
  const content = useLocalizedContent(offerTextSources(offer), offer?.translations, lang)
  // The business name has its own translations; one "Show original" switch flips both.
  const nameContent = useLocalizedContent({ businessName: offer?.businessName ?? '' }, offer?.businessTranslations, lang)
  const businessName = nameContent.text('businessName')
  const headline = superTavHeadline(offer, t('super_tav_headline'))
  const chainPage = !!offer && isChain(offer)
  const image = useDealImage(offer?.imageUrl ?? '', raayonitImageOpts(offer))
  // The brand tiles of a multi-chain pass: the offer's own index, else its chain names matched to the live brand offers, so a missing index never drops to plain text boxes.
  const chainSubject = useMemo(() => (offer ? { offerId: offer.id, perkScope: offer.perkScope, participatingChains: offer.participatingChains, allLiveBrands: true } : null), [offer])
  const liveBrands = useChainBrands(chainSubject)
  const chainBrands = offer?.brandIndex?.length ? offer.brandIndex : liveBrands
  const machine = content.machine || nameContent.machine
  const showingOriginal = content.showingOriginal || nameContent.showingOriginal
  const toggleOriginal = () => {
    content.toggleOriginal()
    nameContent.toggleOriginal()
  }
  const { offers: allOffers } = useOffers()
  // Other perks in the same category, never this one or a sold-out one. The brand's own are one tap away on its brand page.
  const moreInCategory = useMemo(() => {
    // A category is a GoLandly notion: a Raayonit voucher or chain has no "more in category", and a direct perk never lists Raayonit's.
    if (!offer || !allOffers || offer.fulfillmentType === 'raayonit_pool') return []
    return landlyOffers(allOffers).filter((o) => o.id !== offer.id && isOfferAvailable(o) && o.category === offer.category).slice(0, 12)
  }, [offer, allOffers])
  const title = content.text('title')
  const description = content.text('description')
  const descriptionText = distinctDescription(title.text, description.text)
  const instructions = content.text('redemptionInstructions')
  const terms = content.text('redemptionTerms')
  // The full address as Google writes it in the reader's language.
  // Only a single-location perk shows its address and navigation; a multi-branch one shows a notice instead.
  const showLocation = !!offer && shouldShowLocationNavigation(offer)
  const place = offer && showLocation ? offerFullAddress(offer, lang) : ''
  const noticeKind = offer ? locationNoticeKind(offer) : null
  // The stores or chains that honour the perk, when the admin listed any.
  // One venue: its address in the header and its own location section, never "1 store".
  const singleVenue = !!offer && isSingleVenue(offer)
  const venueLine = offer && singleVenue ? offerFullAddress(offer, lang) : ''
  const hasStoreList = noticeKind === 'chains' || noticeKind === 'stores' || (offer?.perkScope === 'multi_chain' && chainBrands.length > 0) || (singleVenue && !!offer?.branches?.length)
  const destination = offer ? { geo: offer.geo, placeId: offer.address?.placeId, address: place || offer.location } : null
  const logo = offer && !heroLogoSource(offer) && !isRaayonitOffer(offer) && (
    <MerchantBadge
      logoUri={badgeLogoUri(secureImageUrl(offer.businessLogoUrl ?? ''), image.uri, image.role)}
      height={panes ? 64 : 56}
      large
      style={panes ? styles.logoPane : styles.logo}
    />
  )

  // A participating chain is not a voucher for one store: its screen sends the visitor to the Raayonit Card (/raayonit).
  if (offer && chainPage) return <ChainOfferView offer={offer} />

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Held landscape, the header steps in from a side cutout like the content below it. */}
      <View style={{ paddingLeft: insets.left, paddingRight: insets.right }}>
        {/* On a phone a found offer floats its back button over the picture. */}
        {(panes || !offer) && <ScreenHeader fallback="/perks" />}
      </View>
      {offer === undefined || (!!offer && isFlagship(offer)) ? (
        <ActivityIndicator color={colors.brand} style={styles.spinner} />
      ) : offer === null ? (
        <View style={styles.notFound}>
          <AppText style={styles.notFoundTitle}>{t('offer_detail_not_found_title')}</AppText>
          <AppText style={styles.notFoundSub}>{t('offer_detail_not_found_sub')}</AppText>
        </View>
      ) : (
        <>
          <Animated.ScrollView ref={scroller} onScroll={onScroll} scrollEventThrottle={16} showsVerticalScrollIndicator={false} showsHorizontalScrollIndicator={false} contentContainerStyle={panes ? [styles.content, { paddingLeft, paddingRight }] : undefined} contentInsetAdjustmentBehavior="automatic">
            <View style={panes ? styles.cardPanes : undefined}>
              <Animated.View onLayout={(e) => heroHeight.set(e.nativeEvent.layout.height)} style={[styles.heroWrap, panes && styles.heroPane, panes && { flex: heroShare }, !panes && heroStyle]}>
                {/* The same picture as the perk card: an offer image that is a logo goes to the badge instead. */}
                <DealMedia image={image} category={offer.category} logo={heroLogoSource(offer)} logoSmall={heroLogoIsFallback(offer)} corners={panes ? 'all' : 'none'} containRatio={4 / 5} containMaxHeight={380}>
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
              </Animated.View>

              <View style={panes ? [styles.body, styles.bodyPane] : [styles.body, styles.sheet]}>
                {!panes && logo}
                {isFlagship(offer) ? <FlagshipEyebrow /> : <OfferTags category={offer.category} method={offer.redemptionMethod} modes={offer.redemptionModes} />}
                {/* A Super Tav leads with its value ("Super Tav — ₪100 Value"), the business on the line below; any other perk keeps business then deal. */}
                {chainPage ? (
                  <>
                    {/* A participating chain's page is the chain's: its name is the heading, with the note that it honours Super Tav. */}
                    <AppText style={[styles.title, styles.titleAfterTags]} accessibilityRole="header">{businessName.text}</AppText>
                    <View style={styles.honors}><LineIcon name="ticket" size={14} color={colors.brand} strokeWidth={1.75} /><AppText style={styles.honorsText}>{t('raayonit_honors_badge')}</AppText></View>
                  </>
                ) : headline ? (
                  <>
                    <AppText style={[styles.title, styles.titleAfterTags]} accessibilityRole="header">{headline}</AppText>
                    <AppText style={[styles.business, styles.businessBelow]}>{businessName.text}</AppText>
                  </>
                ) : (
                  <>
                    <AppText style={[styles.business, styles.businessAfterTags]}>{businessName.text}</AppText>
                    <ContentText contentLang={title.lang} style={styles.title} accessibilityRole="header">{title.text}</ContentText>
                  </>
                )}

                {chainPage && !!headline && <AppText style={styles.valueLine}>{headline}</AppText>}
                {multi && <VariantSelector variants={variants} value={selected?.poolId ?? ''} onChange={setPickedPool} claimed={claimedPools} />}
                <View style={styles.priceRow}>
                  <AppText ltr style={styles.price}>{formatPrice(price)}</AppText>
                  {discount > 0 && <AppText ltr style={styles.original}>{formatPrice(original)}</AppText>}
                  {discount > 0 && <AppText style={styles.saving}>{t('offer_you_save').replace('{amount}', formatPrice(original - price))}</AppText>}
                </View>

                {/* A Raayonit voucher: who issued it, and that it is a code (no QR) valid 5 years. Right under the title and price. */}
                {isPooled(offer.fulfillmentType) && (
                  <View style={styles.issuerTop}>
                    <IssuerAttribution issuer={RAAYONIT_ISSUER} note={t('offer_code_only_info')} />
                  </View>
                )}
                {/* Bought through one brand, it is still a Multi-Chain Super Tav: also redeemable across the network. */}
                {isPooled(offer.fulfillmentType) && offer.perkScope !== 'multi_chain' && <MultiChainBonus onSeeChains={seeChains} />}

                {/* When it stops working: five years from purchase for a Raayonit voucher, else the offer's own date. */}
                {(isPooled(offer.fulfillmentType) || !!offer.expiryDate) && (
                  <View style={styles.expiryRow} accessible>
                    <LineIcon name="calendar" size={16} color={expired ? colors.danger : colors.textMuted} strokeWidth={1.75} />
                    <AppText style={[styles.expiryRowText, expired && styles.expired]}>
                      {isPooled(offer.fulfillmentType) ? t('card_valid_5_years') : t('offer_detail_expires').replace('{date}', formatLongDate(offer.expiryDate!, lang))}
                    </AppText>
                  </View>
                )}

                {/* Text-only pills of what the offer really states; they wrap. */}
                {(remaining !== null || !!offer.kosherBranchCount) && (
                  <View style={styles.chips}>
                    {!!offer.kosherBranchCount && (
                      <View style={[styles.chip, styles.methodChip]}>
                        <AppText style={[styles.chipText, styles.methodText]} numberOfLines={1}>{t('offer_kosher_branches').replace('{count}', isolateLtr(String(offer.kosherBranchCount)))}</AppText>
                      </View>
                    )}
                    {remaining !== null && (
                      <View style={[styles.chip, styles.methodChip]}>
                        <AppText style={[styles.chipText, styles.methodText]} numberOfLines={1}>{t('offer_detail_remaining').replace('{count}', String(remaining))}</AppText>
                      </View>
                    )}
                  </View>
                )}

                {/* Signed out: the way in, as a plain divider row with the action at its end. */}
                {!user && (
                  <View style={styles.loginRow}>
                    <AppText style={styles.loginText}>{t('offer_login_prompt')}</AppText>
                    <Pressable accessibilityRole="link" hitSlop={8} onPress={() => router.navigate('/login')} style={styles.loginLink}>
                      <AppText style={styles.loginAction}>{t('offer_login_action')}</AppText>
                    </Pressable>
                  </View>
                )}

                <RedemptionCallout method={offer.redemptionMethod} instructions={instructions.text} contentLang={instructions.lang} />

                {machine && <TranslationNotice showingOriginal={showingOriginal} onToggle={toggleOriginal} />}

                {/* The header's last row, right above the folds: the address, with the ways to get there at its end. */}
                {!showLocation && locationNoticeKind(offer) !== null && (
                  <View style={styles.location}>
                    <PerkReachLine offer={offer} />
                  </View>
                )}
                {singleVenue && !showLocation && !!venueLine && !hasStoreList && (
                  <View style={styles.location}>
                    <View style={styles.address}>
                      <LineIcon name="pin" size={14} color={colors.textFaint} strokeWidth={2} />
                      <AppText autoDir style={styles.locationText}>{venueLine}</AppText>
                    </View>
                  </View>
                )}
                {showLocation && (!hasStoreList && !!place || (destination && !!navigationLinks(destination))) && (
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

                <RaayonitChainNotes offer={offer} />
                <View ref={chainsAt} collapsable={false} style={styles.folds}>
                  {hasStoreList && (
                    <Accordion title={t(noticeKind === 'chains' ? 'perk_chains_title' : singleVenue ? 'perk_business_location' : 'perk_stores_title')} defaultOpen>
                      {offer.perkScope === 'multi_chain' && chainBrands.length > 0 ? (
                        <View style={{ gap: 14 }}><BrandStrip entries={chainBrands} /><RedemptionGuide offer={offer} /></View>
                      ) : !!offer.branches?.length ? (
                        <BranchStrip branches={offer.branches} brand={offer.brandName || offer.businessName || null} />
                      ) : (
                        <ParticipatingChains offer={offer} />
                      )}
                    </Accordion>
                  )}
                  {!!descriptionText && (
                    <Accordion title={t('offer_about_title')} defaultOpen>
                      <ContentText contentLang={description.lang} style={styles.description}>{descriptionText}</ContentText>
                    </Accordion>
                  )}
                  <Accordion title={t('offer_how_title')} defaultOpen>
                    {(() => {
                      const steps = redemptionSteps(offer.redemptionMethod, instructions.text, t, isPooled(offer.fulfillmentType))
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
                        <ContentText contentLang={instructions.text.trim() ? instructions.lang : null} style={styles.stepText}>{isolateNumbers(step)}</ContentText>
                      </View>
                    ))
                    })()}
                  </Accordion>
                  {!!terms.text && (
                    <Accordion title={t('offer_fine_print_title')} defaultOpen>
                      <ContentText contentLang={terms.lang} style={styles.terms}>{terms.text}</ContentText>
                    </Accordion>
                  )}
                  {isPooled(offer.fulfillmentType) && offer.perkScope !== 'multi_chain' && <ChainsAccordion key={chainsOpen ? 'open' : 'closed'} defaultOpen={chainsOpen} />}
                </View>

                {/* The category rail between two hairline dividers (1pt, 24pt of air each side). */}
                {moreInCategory.length > 0 && (
                  <View style={styles.categoryRail}>
                    <SectionHeader title={t('offer_more_in_category')} action={t('perk_see_all_perks')} onAction={() => router.navigate({ pathname: '/perks', params: { cat: offer.category, brand: '', sort: '', kind: '' } })} />
                    <OfferCarousel offers={moreInCategory} onOpen={openOffer} showDots={false} />
                  </View>
                )}
                <BrandSpotlight offer={offer} image={image} />
              </View>
            </View>
          </Animated.ScrollView>

          {/* Pinned above the home indicator, outside the scroll. */}
          <View style={[styles.actionBar, { paddingBottom: Math.max(insets.bottom, 12), ...bar }]}>
            {claimed && (variants.length === 0 || everyValueOwned) ? (
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
                label={t('offer_buy_button').replace('{price}', formatPrice(price))}
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
  categoryRail: { marginTop: 24, paddingVertical: 24, borderTopWidth: 1, borderBottomWidth: 1, borderColor: '#E2E8F0' },
  issuerTop: { alignSelf: 'stretch', marginTop: 20 },
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
  chips: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginTop: 18 },
  // The chips share one shape: compact, softly rounded, text only.
  chip: { flexDirection: 'row', alignItems: 'center', borderRadius: radius.sm, borderCurve: 'continuous', paddingHorizontal: 10, paddingVertical: 4 },
  chipText: { fontSize: 12, lineHeight: 16, fontWeight: '600' },
  methodChip: { flexShrink: 0, backgroundColor: colors.borderLight },
  methodText: { color: colors.body },
  business: { fontSize: 16, lineHeight: 22, fontWeight: '700', color: colors.body },
  honors: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 },
  honorsText: { fontSize: 13, fontWeight: '600', color: colors.brand },
  valueLine: { marginTop: 14, fontSize: 14, fontWeight: '700', color: colors.heading },
  businessAfterTags: { marginTop: 8 },
  businessBelow: { marginTop: 4 },
  titleAfterTags: { marginTop: 8 },
  title: { fontSize: 24, lineHeight: 30, fontWeight: '800', color: colors.heading, marginTop: 4 },
  location: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 20 },
  address: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'flex-start', gap: 6 },
  locationText: { flex: 1, fontSize: 14, color: colors.textFaint },
  priceRow: { flexDirection: 'row', alignItems: 'baseline', flexWrap: 'wrap', gap: 10, marginTop: 20 },
  price: { fontSize: 28, fontWeight: '800', color: colors.brand, fontVariant: ['tabular-nums'] },
  original: { fontSize: 17, color: colors.textFaint, textDecorationLine: 'line-through', fontVariant: ['tabular-nums'] },
  // Web: text-emerald-700.
  saving: { fontSize: 14, fontWeight: '600', color: colors.discount },
  description: { fontSize: 15, lineHeight: 26, color: colors.body },
  expiredChip: { backgroundColor: '#FEF2F2' },
  expired: { color: colors.danger },
  folds: { marginTop: 28 },
  expiryRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 16 },
  expiryRowText: { flex: 1, fontSize: 14, lineHeight: 20, fontWeight: '600', color: colors.body },
  loginRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginTop: 20, paddingVertical: 12, borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.borderLight },
  loginText: { flex: 1, fontSize: 13, lineHeight: 19, color: colors.body },
  loginLink: { minHeight: 44, justifyContent: 'center', ...webOnly({ cursor: 'pointer' }) },
  loginAction: { fontSize: 14, fontWeight: '800', color: colors.heading, textDecorationLine: 'underline' },
  step: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 12 },
  stepNumber: { width: 24, height: 24, borderRadius: radius.pill, backgroundColor: colors.brandLight, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  stepNumberText: { fontSize: 12, lineHeight: 16, fontWeight: '700', color: colors.brand, textAlign: 'center' },
  stepText: { flex: 1, fontSize: 13, lineHeight: 22, color: colors.body },
  terms: { fontSize: 13, lineHeight: 22, color: colors.textMuted },
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

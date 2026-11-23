import { useMemo } from 'react'
import BrandMedia from './BrandMedia'
import { Image, Pressable, ScrollView, StyleSheet, View, type ImageSourcePropType } from 'react-native'
import { router } from 'expo-router'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
import type { OfferDocument } from '@shared/firebase/offers'
import { useRaayonitDisplay } from '@shared/flags/raayonitDisplayStore'
import { isolateLtr } from '@shared/home/superShowcase'
import { useLocalizedContent } from '@shared/i18n/useLocalizedContent'
import { isolateNumbers } from '@shared/inventory/raayonitRedemption'
import { isFlagship } from '@shared/offers/discoverTab'
import { raayonitCategoryName, raayonitCategoryOf } from '@shared/offers/raayonitCategories'
import { locationNoticeKind } from '@shared/offers/locationVisibility'
import { RAAYONIT_HUB } from '@shared/offers/offerRoutes'
import { distinctDescription, offerTextSources } from '@shared/offers/offerText'
import { roundedCount } from '@shared/offers/raayonitPreview'
import { raayonitStartPrice } from '@shared/offers/raayonitStartPrice'
import { redemptionSteps } from '@shared/offers/redemption'
import { useChainBrands } from '@shared/offers/useChainBrands'
import { useOffers } from '@shared/offers/useOffers'
import Accordion from './Accordion'
import AppText from './AppText'
import BranchStrip from './BranchStrip'
import BrandStrip from './BrandStrip'
import Button from './Button'
import ContactActions from './ContactActions'
import ContentText from './ContentText'
import LineIcon from './LineIcon'
import OfferTags from './OfferTags'
import RaayonitChainNotes from './RaayonitChainNotes'
import ScreenHeader from './ScreenHeader'
import { ParticipatingChains, RedemptionGuide } from './PerkReach'
import { useLang } from '../i18n/LangProvider'
import { heroLogoSource } from '../lib/logoHero'
import { secureImageUrl } from '../lib/imageSource'
import { bundledBrandImage } from '../lib/raayonitBrandImages'
import { useLayout } from '../lib/useLayout'
import { webOnly } from '../lib/webStyles'
import { colors } from '../theme'

const ISSUER_LOGO = require('../../assets/images/raayonit-logo.png') as ImageSourcePropType

// A participating Raayonit chain's screen (web: components/offers/ChainOfferView.tsx). It is not a voucher for this one store: no price, no
// discount ribbon, no denomination picker and no store-specific Buy. One column: the venue (logo, name, "Accepts Raayonit Card", website and
// phone), the participating branches, how to redeem and the fine print, then a pinned action that opens the Raayonit Card page (/raayonit).
export default function ChainOfferView({ offer }: { offer: OfferDocument }) {
  const { t, lang, isRtl } = useLang()
  const insets = useSafeAreaInsets()
  const { paddingLeft, paddingRight, width } = useLayout()
  const display = useRaayonitDisplay()
  const { offers: all } = useOffers()
  const content = useLocalizedContent(offerTextSources(offer), offer.translations, lang)
  const nameContent = useLocalizedContent({ businessName: offer.businessName ?? '' }, offer.businessTranslations, lang)
  const chainSubject = useMemo(() => ({ offerId: offer.id, perkScope: offer.perkScope, participatingChains: offer.participatingChains, allLiveBrands: true }), [offer])
  const liveBrands = useChainBrands(chainSubject)
  const chainBrands = offer.brandIndex?.length ? offer.brandIndex : liveBrands

  const flagship = useMemo(() => (all ?? []).find(isFlagship) ?? null, [all])
  const total = useMemo(() => roundedCount((all ?? []).filter((o) => o.fulfillmentType === 'raayonit_pool' && !isFlagship(o)).length), [all])
  const cta = t('chain_card_cta').replace('{price}', isolateLtr(`₪${raayonitStartPrice(flagship)}`))
  const note = t('chain_card_note').replace('{count}+', isolateLtr(`${total}+`))
  const seeAll = t('chain_all_chains').replace('{count}+', isolateLtr(`${total}+`))
  const openHub = () => router.push(RAAYONIT_HUB)
  // The buy button goes to the buy step (the card with its values), not the hub, as the hub's own "Order voucher" does.
  const openCard = () => router.push('/raayonit-card')

  const name = nameContent.text('businessName')
  const description = content.text('description')
  const descriptionText = distinctDescription(content.text('title').text, description.text)
  const instructions = content.text('redemptionInstructions')
  const terms = content.text('redemptionTerms')
  // As on the website: the logo-only hero, else the card's own picture (a bundled brand image or a link), else the Raayonit mark.
  const own = offer.imageUrl?.trim() ? bundledBrandImage(offer.imageUrl) ?? (secureImageUrl(offer.imageUrl) ? { uri: secureImageUrl(offer.imageUrl) } : null) : null
  const logo = heroLogoSource(offer) ?? own ?? ISSUER_LOGO

  const noticeKind = locationNoticeKind(offer)
  const hasBranches = !!offer.branches?.length
  const hasList = hasBranches || noticeKind === 'chains' || noticeKind === 'stores' || (offer.perkScope === 'multi_chain' && chainBrands.length > 0)
  const steps = redemptionSteps(offer.redemptionMethod, instructions.text, t, true)
  const numbered = instructions.text.trim() !== '' && steps.length > 1
  const column = width >= 720 ? { maxWidth: 720, width: '100%' as const, alignSelf: 'center' as const } : null

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={{ paddingLeft: insets.left, paddingRight: insets.right }}><ScreenHeader fallback="/perks" /></View>
      <ScrollView showsVerticalScrollIndicator={false} showsHorizontalScrollIndicator={false} contentContainerStyle={[styles.content, { paddingLeft: paddingLeft + 16, paddingRight: paddingRight + 16, paddingBottom: 110 + insets.bottom }]}>
        <View style={[styles.stack, column]}>
          <View style={styles.header}>
            <View style={styles.logoBox}>
              {logo && <BrandMedia source={logo} cover={offer.logoKind === 'photo'} recyclingKey={offer.id} inset={16} />}
            </View>
            <OfferTags categoryName={raayonitCategoryName(raayonitCategoryOf(offer), lang)} category={offer.category} method={offer.redemptionMethod} modes={offer.redemptionModes} />
            <AppText autoDir accessibilityRole="header" style={styles.title}>{name.text}</AppText>
            <View style={styles.badge}>
              <LineIcon name="ticket" size={14} color={colors.brand} strokeWidth={1.75} />
              <AppText style={styles.badgeText}>{t('businesses_accepts')}</AppText>
            </View>
            <AppText style={styles.note}>{note}</AppText>
            <ContactActions websiteUrl={offer.websiteUrl} phone={offer.contactPhone} />
            <View style={styles.issuer}>
              {display && <View style={styles.issuerLogoFrame}><Image source={ISSUER_LOGO} style={styles.issuerLogo} resizeMode="contain" accessible={false} /></View>}
              <AppText style={styles.issuerText}>{t('chain_issued_by')}</AppText>
            </View>
          </View>

          <RaayonitChainNotes offer={offer} />

          {hasList && (
            <View style={styles.card}>
              <AppText accessibilityRole="header" style={styles.h2}>{t(noticeKind === 'chains' ? 'perk_chains_title' : 'perk_stores_title')}</AppText>
              {offer.perkScope === 'multi_chain' && chainBrands.length > 0 ? (
                <View style={{ gap: 14 }}><BrandStrip entries={chainBrands} /><RedemptionGuide offer={offer} /></View>
              ) : hasBranches ? (
                <BranchStrip branches={offer.branches!} brand={offer.brandName || offer.businessName || null} />
              ) : (
                <ParticipatingChains offer={offer} />
              )}
            </View>
          )}

          {!!descriptionText && (
            <View style={styles.card}>
              <AppText accessibilityRole="header" style={styles.h2}>{t('offer_about_title')}</AppText>
              <ContentText contentLang={description.lang} style={styles.body}>{descriptionText}</ContentText>
            </View>
          )}

          <View style={styles.folds}>
            <Accordion title={t('offer_how_title')} defaultOpen>
              {steps.map((step, i) => (
                <View key={i} style={styles.step} accessible accessibilityLabel={numbered ? `${i + 1}. ${step}` : step}>
                  {numbered && <View style={styles.stepNumber}><AppText ltr style={styles.stepNumberText}>{i + 1}</AppText></View>}
                  <ContentText contentLang={instructions.text.trim() ? instructions.lang : null} style={styles.stepText}>{isolateNumbers(step)}</ContentText>
                </View>
              ))}
            </Accordion>
            {!!terms.text && (
              <Accordion title={t('offer_fine_print_title')} defaultOpen>
                <ContentText contentLang={terms.lang} style={styles.body}>{terms.text}</ContentText>
              </Accordion>
            )}
          </View>

          <Pressable accessibilityRole="link" onPress={openHub} style={({ pressed }) => [styles.seeAll, pressed && styles.pressed]}>
            <AppText style={styles.seeAllText}>{seeAll}</AppText>
            <LineIcon name="chevronEnd" size={16} color={colors.brand} strokeWidth={2} flip={isRtl} />
          </Pressable>
        </View>
      </ScrollView>

      {/* Pinned above the home indicator, outside the scroll. */}
      <View style={[styles.actionBar, { paddingBottom: Math.max(insets.bottom, 12), paddingLeft: paddingLeft + 16, paddingRight: paddingRight + 16 }]}>
        <View style={column}><Button label={cta} onPress={openCard} large /></View>
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { paddingTop: 8 },
  stack: { gap: 16 },
  header: { gap: 10, alignItems: 'flex-start', padding: 16, borderRadius: 24, borderCurve: 'continuous', borderWidth: 1, borderColor: '#E2E8F0', backgroundColor: '#FFFFFF' },
  logoBox: { width: 144, height: 144, alignSelf: 'center', overflow: 'hidden', borderRadius: 20, borderCurve: 'continuous', borderWidth: 1, borderColor: '#E2E8F0', backgroundColor: '#EEF2F7' },
  title: { fontSize: 26, lineHeight: 32, fontWeight: '900', letterSpacing: -0.5, color: colors.heading },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 5, borderRadius: 999, backgroundColor: colors.brandTint },
  badgeText: { fontSize: 13, fontWeight: '600', color: colors.brand },
  note: { fontSize: 14, lineHeight: 20, color: colors.textMuted },
  issuer: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  issuerLogoFrame: { height: 30, paddingHorizontal: 3, borderRadius: 6, borderWidth: 1, borderColor: '#E2E8F0', backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  issuerLogo: { width: 14, height: 24 },
  issuerText: { fontSize: 12, color: colors.textMuted },
  card: { gap: 12, padding: 16, borderRadius: 24, borderCurve: 'continuous', borderWidth: 1, borderColor: '#E2E8F0', backgroundColor: '#FFFFFF' },
  h2: { fontSize: 18, lineHeight: 24, fontWeight: '800', letterSpacing: -0.3, color: colors.heading },
  body: { fontSize: 15, lineHeight: 22, color: colors.textStrong },
  folds: { gap: 0 },
  step: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingVertical: 4 },
  stepNumber: { width: 24, height: 24, borderRadius: 12, backgroundColor: colors.brandTint, alignItems: 'center', justifyContent: 'center' },
  stepNumberText: { fontSize: 13, fontWeight: '800', color: colors.brand },
  stepText: { flex: 1, fontSize: 15, lineHeight: 22, color: colors.textStrong },
  seeAll: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 4, ...webOnly({ cursor: 'pointer' }) },
  seeAllText: { fontSize: 14, fontWeight: '700', color: colors.brand },
  pressed: { opacity: 0.6 },
  actionBar: { paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#E2E8F0', backgroundColor: 'rgba(255,255,255,0.96)' },
})

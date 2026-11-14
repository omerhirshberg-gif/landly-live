import { useEffect, useState } from 'react'
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native'
import { useLocalSearchParams } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { redeemVoucherKey, subscribeToVoucher, type VoucherDocument } from '@shared/firebase/vouchers'
import { formatLongDate } from '@shared/format'
import { voucherDestination } from '@shared/member/voucherDestination'
import { locationNoticeKind } from '@shared/offers/locationVisibility'
import { REDEMPTION_METHOD_LABEL_KEYS, redemptionSteps } from '@shared/offers/redemption'
import { useLocalizedContent } from '@shared/i18n/useLocalizedContent'
import { offerTextSources } from '@shared/offers/offerText'
import { localizedBusinessName } from '@shared/business/businessText'
import AddToAppleWallet from '../../components/AddToAppleWallet'
import AppText from '../../components/AppText'
import ContentText from '../../components/ContentText'
import TranslationNotice from '../../components/TranslationNotice'
import LineIcon from '../../components/LineIcon'
import NavigationButtons from '../../components/NavigationButtons'
import { ParticipatingChains, PerkReachLine, RedemptionGuide } from '../../components/PerkReach'
import VoucherCover from '../../components/VoucherCover'
import VoucherTicket from '../../components/VoucherTicket'
import ScreenHeader from '../../components/ScreenHeader'
import { CodeReveal, QrReveal } from '../../components/VoucherReveal'
import { useLang } from '../../i18n/LangProvider'
import { colors, radius } from '../../theme'

type Voucher = VoucherDocument & { id: string }

// One voucher as its own screen (web: /member/vouchers/[voucherId]), pushed
// from a My Pass card as a page flip (lib/pageFlip.ts): a full-screen swipe
// in the reading direction turns it back, the same as the header's back
// button. The perk's photo and the business's logo up top, then a ticket: the business and
// the deal above a perforation, and below it the QR code and
// the numeric code -- each on the back of a card that turns over when tapped
// (components/VoucherReveal.tsx) -- then how to redeem, validity and terms, and the order number. Live from Firestore, so a pass
// the business redeems turns into the "already redeemed" notice in place.
// A render error here shows the retry card; the rest of the app stays up.
export { default as ErrorBoundary } from '../../components/RouteErrorBoundary'

export default function VoucherScreen() {
  const { t, lang } = useLang()
  const { voucherId } = useLocalSearchParams<{ voucherId: string }>()
  // undefined while loading; null when missing or someone else's (rules deny both alike).
  const [voucher, setVoucher] = useState<Voucher | null | undefined>(undefined)
  // Read once per mount, since render must stay pure.
  const [now] = useState(Date.now)

  useEffect(() => {
    if (!voucherId) return
    return subscribeToVoucher(voucherId, setVoucher)
  }, [voucherId])

  const expired = !!voucher?.expiresAt && voucher.expiresAt.getTime() < now
  // The voucher's own translation, frozen at purchase like its terms.
  const content = useLocalizedContent(offerTextSources(voucher), voucher?.translations, lang)
  const title = content.text('title')
  const instructions = content.text('redemptionInstructions')
  const terms = content.text('redemptionTerms')
  const businessName = voucher ? localizedBusinessName(voucher, lang).text : ''
  const { place, destination } = voucher ? voucherDestination(voucher, lang) : { place: '', destination: null }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <ScreenHeader title={t('voucher_page_title')} fallback="/wallet" />
      {voucher === undefined ? (
        <ActivityIndicator color={colors.brand} style={styles.spinner} />
      ) : voucher === null ? (
        <AppText style={styles.notFound}>{t('voucher_not_found')}</AppText>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} showsHorizontalScrollIndicator={false} contentContainerStyle={styles.content} contentInsetAdjustmentBehavior="automatic">
          <VoucherTicket
            top={
              <>
                <VoucherCover voucher={voucher} name={businessName} ratio={2} maxHeight={200} logoHeight={56} />
                <View style={styles.head}>
                  <AppText style={styles.business} accessibilityRole="header">{businessName}</AppText>
                  <ContentText contentLang={title.lang} style={styles.title}>{title.text}</ContentText>
                  {content.machine && <TranslationNotice showingOriginal={content.showingOriginal} onToggle={content.toggleOriginal} />}
                  <View style={styles.chips}>
                    <View style={styles.methodChip}>
                      <AppText style={styles.methodText}>{t(REDEMPTION_METHOD_LABEL_KEYS[voucher.redemptionMethod])}</AppText>
                    </View>
                    {voucher.expiresAt && (
                      <View style={styles.validityRow}>
                        <LineIcon name="clock" size={14} color={expired ? colors.danger : colors.textMuted} strokeWidth={1.75} />
                        <AppText style={[styles.validity, expired && styles.expired]}>
                          {t(expired ? 'voucher_expired_on' : 'voucher_valid_until').replace('{date}', formatLongDate(voucher.expiresAt, lang))}
                        </AppText>
                      </View>
                    )}
                  </View>
                  {!destination && !place && locationNoticeKind(voucher) !== null && (
                    <View style={styles.address}>
                      <PerkReachLine offer={voucher} />
                    </View>
                  )}
                  {!destination && !place && (locationNoticeKind(voucher) === 'stores' || locationNoticeKind(voucher) === 'chains') && (
                    <View style={styles.stores}>
                      <ParticipatingChains offer={voucher} guide={false} />
                    </View>
                  )}
                  {!!place && (
                    <View style={styles.address}>
                      <LineIcon name="pin" size={14} color={colors.textFaint} strokeWidth={1.75} />
                      <AppText style={styles.addressText}>{place}</AppText>
                    </View>
                  )}
                  {destination && (
                    <View style={styles.nav}>
                      <NavigationButtons destination={destination} wide />
                    </View>
                  )}
                </View>
              </>
            }
            stub={
              <>
                {voucher.status === 'active' ? (
                  <>
                    <QrReveal redeemKey={redeemVoucherKey(voucher)} />
                    <View style={styles.gap} />
                    <CodeReveal code={voucher.externalCode ?? voucher.redemptionCode} />
                    <AddToAppleWallet voucher={voucher} />
                  </>
                ) : (
                  <AppText style={styles.redeemed} accessibilityLiveRegion="polite">{t('voucher_already_redeemed')}</AppText>
                )}
                {/* Vouchers issued before order numbering have none to show. */}
                {voucher.displayOrderNumber && (
                  <View style={styles.orderRow}>
                    <AppText style={styles.orderLabel}>{t('success_order_number_label')}</AppText>
                    <AppText ltr selectable style={styles.orderNumber}>{voucher.displayOrderNumber}</AppText>
                  </View>
                )}
              </>
            }
          />

          <View style={styles.panel}>
            <AppText style={styles.howTitle} accessibilityRole="header">{t('redeem_how_title')}</AppText>
            {/* A multi-chain pass is redeemed with its issuer: the guide leads, ahead of the generic steps. */}
            {voucher.perkScope === 'multi_chain' && <View style={styles.guideBlock}><RedemptionGuide offer={voucher} /></View>}
            {(() => {
              const steps = redemptionSteps(voucher.redemptionMethod, instructions.text, t)
              // Numbers only for the merchant's own multi-line instructions, where order matters.
              const numbered = instructions.text.trim() !== '' && steps.length > 1
              return steps.map((step, i) => (
                <View key={i} style={styles.step} accessibilityLabel={numbered ? `${i + 1}. ${step}` : step} accessible>
                  {numbered && (
                    <View style={styles.stepNumber}>
                      <AppText ltr style={styles.stepNumberText}>{i + 1}</AppText>
                    </View>
                  )}
                  <ContentText contentLang={instructions.text.trim() ? instructions.lang : null} style={styles.stepText}>{step}</ContentText>
                </View>
              ))
            })()}
            {!!terms.text && (
              <>
                <AppText style={styles.termsLabel} accessibilityRole="header">{t('voucher_redemption_terms_label')}</AppText>
                <ContentText contentLang={terms.lang} style={styles.terms}>{terms.text}</ContentText>
              </>
            )}
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  spinner: { marginTop: 48 },
  notFound: { fontSize: 15, color: colors.body, textAlign: 'center', marginTop: 48, paddingHorizontal: 24 },
  // The pass stays phone-sized on an unfolded foldable or a tablet: a centred
  // column no wider than the website's (max-w-xl, 576 plus the gutters), so
  // its 16:9 picture and the QR code never balloon.
  content: { width: '100%', maxWidth: 608, alignSelf: 'center', paddingHorizontal: 16, paddingTop: 4, paddingBottom: 32 },
  // Clears the logo's overhang (56pt tile, 40% of it below the cover).
  head: { paddingHorizontal: 20, paddingTop: 34, paddingBottom: 18 },
  business: { fontSize: 26, lineHeight: 32, fontWeight: '800', letterSpacing: -0.3, color: colors.heading },
  title: { fontSize: 15, lineHeight: 21, fontWeight: '500', color: colors.body, marginTop: 4 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: 12, rowGap: 8, marginTop: 14 },
  methodChip: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.brandTint, borderRadius: radius.chip, paddingHorizontal: 10, paddingVertical: 4 },
  methodText: { fontSize: 12, fontWeight: '600', color: colors.brand },
  validityRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  stores: { marginTop: 12 },
  guideBlock: { marginBottom: 14 },
  address: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, marginTop: 14 },
  addressText: { flex: 1, fontSize: 13, lineHeight: 18, color: colors.textMuted },
  nav: { marginTop: 12 },
  gap: { height: 16 },
  redeemed: { padding: 16, borderRadius: radius.lg, backgroundColor: colors.background, fontSize: 14, fontWeight: '600', color: colors.body, textAlign: 'center' },
  panel: { marginTop: 16, padding: 20, borderRadius: radius.lg, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.borderLight },
  howTitle: { fontSize: 15, fontWeight: '700', color: colors.heading, marginBottom: 12 },
  step: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 10 },
  stepNumber: { width: 22, height: 22, borderRadius: radius.pill, backgroundColor: colors.brandLight, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  stepNumberText: { fontSize: 11, fontWeight: '700', color: colors.brand, textAlign: 'center' },
  stepText: { flex: 1, fontSize: 13, lineHeight: 19, color: colors.body },
  validity: { fontSize: 13, fontWeight: '600', color: colors.textMuted },
  expired: { color: colors.danger },
  termsLabel: { fontSize: 12, fontWeight: '700', color: colors.textStrong, marginTop: 14, marginBottom: 4 },
  terms: { fontSize: 13, lineHeight: 19, color: colors.textMuted },
  orderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginTop: 20, paddingTop: 14, borderTopWidth: 1, borderTopColor: colors.borderLight },
  orderLabel: { fontSize: 13, color: colors.textMuted },
  orderNumber: { fontSize: 14, fontWeight: '600', color: colors.text, fontVariant: ['tabular-nums'] },
})

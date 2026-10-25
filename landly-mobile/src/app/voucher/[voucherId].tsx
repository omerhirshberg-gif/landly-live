import { useEffect, useState } from 'react'
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native'
import { useLocalSearchParams } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { getOffer, type OfferDocument } from '@shared/firebase/offers'
import { redeemVoucherKey, subscribeToVoucher, type VoucherDocument } from '@shared/firebase/vouchers'
import { formatLongDate } from '@shared/format'
import { REDEMPTION_METHOD_LABEL_KEYS, redemptionSteps } from '@shared/offers/redemption'
import { useLocalizedContent } from '@shared/i18n/useLocalizedContent'
import { offerTextSources } from '@shared/offers/offerText'
import { localizedBusinessName } from '@shared/business/businessText'
import AppText from '../../components/AppText'
import ContentText from '../../components/ContentText'
import TranslationNotice from '../../components/TranslationNotice'
import LineIcon from '../../components/LineIcon'
import { REDEMPTION_METHOD_ICONS } from '../../components/OfferCard'
import PerkImage from '../../components/PerkImage'
import ScreenHeader from '../../components/ScreenHeader'
import { CodeReveal, QrReveal } from '../../components/VoucherReveal'
import { useLang } from '../../i18n/LangProvider'
import { colors, radius } from '../../theme'

type Voucher = VoucherDocument & { id: string }

// One voucher as its own screen (web: /member/vouchers/[voucherId]), pushed
// from a My Pass card as a page flip (lib/pageFlip.ts): a full-screen swipe
// in the reading direction turns it back, the same as the header's back
// button. The perk's photo and the business name up top, then the QR code and
// the numeric code -- each on the back of a card that turns over when tapped
// (components/VoucherReveal.tsx) -- then how to redeem, validity and terms, and the order number. Live from Firestore, so a pass
// the business redeems turns into the "already redeemed" notice in place.
export default function VoucherScreen() {
  const { t, lang } = useLang()
  const { voucherId } = useLocalSearchParams<{ voucherId: string }>()
  // undefined while loading; null when missing or someone else's (rules deny both alike).
  const [voucher, setVoucher] = useState<Voucher | null | undefined>(undefined)
  const [offer, setOffer] = useState<OfferDocument | null>(null)
  // Read once per mount, since render must stay pure.
  const [now] = useState(Date.now)

  useEffect(() => {
    if (!voucherId) return
    return subscribeToVoucher(voucherId, setVoucher)
  }, [voucherId])

  const offerId = voucher?.offerId
  useEffect(() => {
    if (!offerId) return
    let cancelled = false
    getOffer(offerId)
      .then((next) => {
        if (!cancelled) setOffer(next)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [offerId])

  const expired = !!voucher?.expiresAt && voucher.expiresAt.getTime() < now
  // The voucher's own translation, frozen at purchase like its terms.
  const content = useLocalizedContent(offerTextSources(voucher), voucher?.translations, lang)
  const title = content.text('title')
  const instructions = content.text('redemptionInstructions')
  const terms = content.text('redemptionTerms')

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <ScreenHeader title={t('voucher_page_title')} fallback="/wallet" />
      {voucher === undefined ? (
        <ActivityIndicator color={colors.brand} style={styles.spinner} />
      ) : voucher === null ? (
        <AppText style={styles.notFound}>{t('voucher_not_found')}</AppText>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} showsHorizontalScrollIndicator={false} contentContainerStyle={styles.content} contentInsetAdjustmentBehavior="automatic">
          <View style={styles.card}>
            <View style={styles.hero}>
              {offer && <PerkImage uri={offer.imageUrl} category={offer.category} businessName={offer.businessName} />}
            </View>
            <View style={styles.body}>
              <AppText style={styles.business} accessibilityRole="header">{localizedBusinessName(voucher, lang).text}</AppText>
              <ContentText contentLang={title.lang} style={styles.title}>{title.text}</ContentText>
              {content.machine && <TranslationNotice showingOriginal={content.showingOriginal} onToggle={content.toggleOriginal} />}
              <View style={styles.methodChip}>
                <LineIcon name={REDEMPTION_METHOD_ICONS[voucher.redemptionMethod]} size={13} color={colors.brand} strokeWidth={2.2} />
                <AppText style={styles.methodText}>{t(REDEMPTION_METHOD_LABEL_KEYS[voucher.redemptionMethod])}</AppText>
              </View>

              {voucher.status === 'active' ? (
                <>
                  <View style={styles.divider} />
                  <QrReveal redeemKey={redeemVoucherKey(voucher)} />
                  <View style={styles.divider} />
                  <CodeReveal code={voucher.redemptionCode} />
                </>
              ) : (
                <AppText style={styles.redeemed} accessibilityLiveRegion="polite">{t('voucher_already_redeemed')}</AppText>
              )}

              <View style={styles.divider} />
              <AppText style={styles.howTitle} accessibilityRole="header">{t('redeem_how_title')}</AppText>
              {redemptionSteps(voucher.redemptionMethod, instructions.text, t).map((step, i) => (
                <View key={i} style={styles.step} accessibilityLabel={`${i + 1}. ${step}`} accessible>
                  <View style={styles.stepNumber}>
                    <AppText ltr style={styles.stepNumberText}>{i + 1}</AppText>
                  </View>
                  <ContentText contentLang={instructions.text.trim() ? instructions.lang : null} style={styles.stepText}>{step}</ContentText>
                </View>
              ))}

              {(voucher.expiresAt || terms.text) && <View style={styles.divider} />}
              {voucher.expiresAt && (
                <AppText style={[styles.validity, expired && styles.expired]}>
                  {t(expired ? 'voucher_expired_on' : 'voucher_valid_until').replace('{date}', formatLongDate(voucher.expiresAt, lang))}
                </AppText>
              )}
              {!!terms.text && (
                <>
                  <AppText style={styles.termsLabel} accessibilityRole="header">{t('voucher_redemption_terms_label')}</AppText>
                  <ContentText contentLang={terms.lang} style={styles.terms}>{terms.text}</ContentText>
                </>
              )}

              {/* Vouchers issued before order numbering have none to show. */}
              {voucher.displayOrderNumber && (
                <>
                  <View style={styles.divider} />
                  <View style={styles.orderRow}>
                    <AppText style={styles.orderLabel}>{t('success_order_number_label')}</AppText>
                    <AppText ltr selectable style={styles.orderNumber}>{voucher.displayOrderNumber}</AppText>
                  </View>
                </>
              )}
            </View>
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
  card: { backgroundColor: colors.white, borderRadius: 24, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' },
  hero: { aspectRatio: 16 / 9, backgroundColor: colors.brandTint },
  body: { padding: 20 },
  business: { fontSize: 30, lineHeight: 36, fontWeight: '900', color: colors.heading },
  title: { fontSize: 16, fontWeight: '600', color: colors.body, marginTop: 4 },
  methodChip: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: colors.brandTint,
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginTop: 12,
  },
  methodText: { fontSize: 12, fontWeight: '600', color: colors.brand },
  divider: { height: 1, backgroundColor: colors.borderLight, marginVertical: 24 },
  redeemed: { marginTop: 24, padding: 16, borderRadius: radius.lg, backgroundColor: colors.background, fontSize: 14, fontWeight: '600', color: colors.body, textAlign: 'center' },
  howTitle: { fontSize: 14, fontWeight: '700', color: colors.heading, marginBottom: 12 },
  step: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 10 },
  stepNumber: { width: 22, height: 22, borderRadius: radius.pill, backgroundColor: colors.brand, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  stepNumberText: { fontSize: 11, fontWeight: '700', color: colors.white, textAlign: 'center' },
  stepText: { flex: 1, fontSize: 13, lineHeight: 19, color: colors.body },
  validity: { fontSize: 13, fontWeight: '600', color: colors.textMuted },
  expired: { color: colors.danger },
  termsLabel: { fontSize: 12, fontWeight: '700', color: colors.textStrong, marginTop: 12, marginBottom: 4 },
  terms: { fontSize: 13, lineHeight: 19, color: colors.textMuted },
  orderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  orderLabel: { fontSize: 13, color: colors.textMuted },
  orderNumber: { fontSize: 14, fontWeight: '600', color: colors.text, fontVariant: ['tabular-nums'] },
})

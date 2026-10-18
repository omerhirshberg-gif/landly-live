import { useCallback, useEffect, useRef, useState } from 'react'
import { ActivityIndicator, BackHandler, ScrollView, StyleSheet, View } from 'react-native'
import { router, Stack, useLocalSearchParams, type Href } from 'expo-router'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
import { getOffer, type OfferDocument } from '@shared/firebase/offers'
import { subscribeToOrder } from '@shared/firebase/orders'
import { hasUserClaimedOffer } from '@shared/firebase/vouchers'
import { useAuth } from '@shared/firebase/useAuth'
import { formatPrice, priceDifference } from '@shared/format'
import type { TranslationKey } from '@shared/i18n/translations'
import { initiateCheckout, settleSandboxOrder, type CheckoutFailure, type CheckoutOrder } from '@shared/payments/checkoutClient'
import { cancellationFeeAgorot } from '@shared/payments/voucherTerms'
import AppText from '../../components/AppText'
import Button from '../../components/Button'
import ConsentText from '../../components/ConsentText'
import LineIcon from '../../components/LineIcon'
import Notice from '../../components/Notice'
import PerkImage from '../../components/PerkImage'
import ScreenHeader from '../../components/ScreenHeader'
import TranzilaPaymentStep from '../../components/TranzilaPaymentStep'
import { useLang } from '../../i18n/LangProvider'
import { API_BASE_URL } from '../../lib/env'
import { cachedOffer } from '../../lib/openOffer'
import { colors, radius } from '../../theme'

const FAILURE_KEYS: Record<CheckoutFailure, TranslationKey> = {
  unauthorized: 'del_session_expired',
  conflict: 'checkout_error_unavailable',
  rateLimited: 'del_rate_limited',
  failed: 'checkout_error_generic',
  offline: 'verifyNotice_offline',
}

// The in-app checkout (web: /checkout?offerId=…), pushed from the offer
// screen's Buy button as a page flip (lib/pageFlip.ts). Nothing here leaves
// the app. On open it creates -- or reads back -- the member's pending order
// through /api/payments/initiate, which freezes the price, validity and
// terms the summary shows. Accepting the Terms is clickwrap: the line above
// the Pay button says paying accepts them, and Pay records it on the order.
//
// Then the order settles server-side, never here. A local dev sandbox order
// (lib/payments/devSandbox.ts) settles on the spot through the webhook's own
// transaction; a live terminal order goes to the card step
// (components/TranzilaPaymentStep.tsx) while this screen listens to the order
// until the Tranzila webhook marks it paid. Either way a success replaces
// this screen with the order confirmation (app/order-success/[orderId].tsx),
// so back from there lands on the offer, now "claimed", never on checkout.
// While a payment is in flight the dimmed overlay holds the screen: no swipe
// back, no Android back, no second tap.
export default function CheckoutScreen() {
  const { t } = useLang()
  const insets = useSafeAreaInsets()
  const { offerId } = useLocalSearchParams<{ offerId: string }>()
  const { user } = useAuth()
  // The photo and category are decoration from the live offer; the order holds what is bought.
  const [offer, setOffer] = useState<OfferDocument | undefined>(() => (offerId ? cachedOffer(offerId) : undefined))
  const [order, setOrder] = useState<CheckoutOrder | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [claimed, setClaimed] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const [step, setStep] = useState<'summary' | 'payment'>('summary')
  const [paying, setPaying] = useState(false)
  const [payError, setPayError] = useState<string | null>(null)
  // Set synchronously, so a double tap can't start a second payment.
  const busy = useRef(false)
  const completed = useRef(false)

  const failureMessage = useCallback((reason: CheckoutFailure) => t(FAILURE_KEYS[reason]), [t])

  useEffect(() => {
    if (!offerId) return
    let cancelled = false
    getOffer(offerId)
      .then((next) => {
        if (!cancelled && next) setOffer(next)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [offerId])

  const uid = user?.uid
  // A refused order (409) is most often one the member already owns.
  const isClaimed = useCallback(
    () => (uid && offerId ? hasUserClaimedOffer(uid, offerId).catch(() => false) : Promise.resolve(false)),
    [uid, offerId]
  )

  useEffect(() => {
    if (!user || !offerId) return
    let cancelled = false
    ;(async () => {
      try {
        const result = await initiateCheckout(await user.getIdToken(), offerId, {}, API_BASE_URL)
        if (cancelled) return
        if (result.ok) {
          setOrder(result.data)
          return
        }
        if (result.reason === 'conflict' && (await isClaimed())) {
          if (!cancelled) setClaimed(true)
          return
        }
        if (!cancelled) setLoadError(failureMessage(result.reason))
      } catch {
        // getIdToken: no connection to refresh the token.
        if (!cancelled) setLoadError(failureMessage('offline'))
      }
    })()
    return () => {
      cancelled = true
    }
  }, [user, offerId, attempt, isClaimed, failureMessage])

  const retry = () => {
    setLoadError(null)
    setAttempt((n) => n + 1)
  }

  const complete = useCallback((orderId: string) => {
    if (completed.current) return
    completed.current = true
    router.replace({ pathname: '/order-success/[orderId]', params: { orderId } })
  }, [])

  // Live terminal: the webhook settles the order while the card step shows.
  const orderId = order?.orderId
  useEffect(() => {
    if (step !== 'payment' || !orderId) return
    return subscribeToOrder(orderId, (next) => {
      if (next?.status === 'paid') complete(orderId)
      else if (next?.status === 'failed') {
        setPayError(t('checkout_failed_sub'))
        setStep('summary')
      }
    })
  }, [step, orderId, complete, t])

  // Android's back button waits for the payment, like the swipe and the header.
  useEffect(() => {
    if (!paying) return
    const sub = BackHandler.addEventListener('hardwareBackPress', () => true)
    return () => sub.remove()
  }, [paying])

  const pay = async () => {
    if (!user || !offerId || !order || busy.current) return
    busy.current = true
    setPaying(true)
    setPayError(null)
    try {
      const idToken = await user.getIdToken()
      const accepted = await initiateCheckout(idToken, offerId, { acceptTerms: true }, API_BASE_URL)
      if (!accepted.ok) {
        if (accepted.reason === 'conflict' && (await isClaimed())) setClaimed(true)
        else setPayError(failureMessage(accepted.reason))
        return
      }
      setOrder(accepted.data)
      if (!accepted.data.sandbox) {
        setStep('payment')
        return
      }
      const settled = await settleSandboxOrder(idToken, accepted.data.orderId, 'approve', API_BASE_URL)
      if (!settled.ok) {
        setPayError(failureMessage(settled.reason))
        return
      }
      complete(accepted.data.orderId)
    } catch {
      setPayError(failureMessage('offline'))
    } finally {
      busy.current = false
      // A completed payment keeps the overlay up until the confirmation replaces the screen.
      if (!completed.current) setPaying(false)
    }
  }

  const discount = order?.originalPrice ? priceDifference(order.originalPrice, order.amount) : 0
  const fee = order ? cancellationFeeAgorot(Math.round(order.amount * 100)) / 100 : 0
  const backFallback: Href = offerId ? { pathname: '/offer/[offerId]', params: { offerId } } : '/perks'

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <Stack.Screen options={{ gestureEnabled: !paying }} />
      <ScreenHeader title={t('checkout_title')} fallback={backFallback} />

      {claimed ? (
        <View style={styles.centered}>
          <View style={styles.stateIcon}>
            <LineIcon name="check" size={24} color={colors.success} strokeWidth={2.4} />
          </View>
          <AppText style={styles.stateTitle}>{t('offer_already_claimed_title')}</AppText>
          <AppText style={styles.stateSub}>{t('offer_already_claimed_sub')}</AppText>
          <View style={styles.stateAction}>
            <Button label={t('home_pass_cta')} onPress={() => router.navigate('/wallet')} />
          </View>
        </View>
      ) : loadError ? (
        <View style={styles.centered}>
          <Notice message={loadError} />
          <Button label={t('err_retry')} variant="secondary" onPress={retry} />
        </View>
      ) : !order ? (
        <View style={styles.centered} accessibilityRole="progressbar" accessibilityLabel={t('checkout_loading')}>
          <ActivityIndicator color={colors.brand} />
          <AppText style={styles.loadingText}>{t('checkout_loading')}</AppText>
        </View>
      ) : step === 'payment' ? (
        <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]}>
          <TranzilaPaymentStep offerTitle={order.offerTitle} amount={order.amount} onBack={() => setStep('summary')} />
        </ScrollView>
      ) : (
        <>
          <ScrollView contentContainerStyle={styles.content} contentInsetAdjustmentBehavior="automatic">
            <View style={styles.card}>
              {/* Who and what: photo (or the category panel), business, offer. */}
              <View style={styles.offerRow}>
                <View style={styles.thumb}>
                  {offer && <PerkImage uri={offer.imageUrl} category={offer.category} businessName={offer.businessName} />}
                </View>
                <View style={styles.offerText}>
                  <AppText style={styles.business} numberOfLines={1}>{order.businessName}</AppText>
                  <AppText style={styles.offerTitle} accessibilityRole="header">{order.offerTitle}</AppText>
                </View>
              </View>

              {/* The itemised price, VAT included, and what the member saves. */}
              <View style={styles.priceBox}>
                {order.originalPrice !== null && discount > 0 && (
                  <>
                    <View style={styles.priceRow}>
                      <AppText style={styles.priceLabel}>{t('checkout_original_price_label')}</AppText>
                      <AppText ltr style={[styles.priceLabel, styles.struck]}>{formatPrice(order.originalPrice)}</AppText>
                    </View>
                    <View style={styles.priceRow}>
                      <AppText style={styles.priceLabel}>{t('checkout_discount_label')}</AppText>
                      <AppText ltr style={styles.discountValue}>-{formatPrice(discount)}</AppText>
                    </View>
                  </>
                )}
                <View style={[styles.priceRow, styles.totalRow]}>
                  <AppText style={styles.totalLabel}>{t('checkout_total_label')}</AppText>
                  <AppText ltr style={styles.totalValue}>{formatPrice(order.amount)}</AppText>
                </View>
                <AppText style={styles.vatNote}>{t('checkout_vat_note')}</AppText>
                {discount > 0 && (
                  <View style={styles.savings}>
                    <LineIcon name="tag" size={13} color={colors.success} strokeWidth={2.2} />
                    <AppText style={styles.savingsText}>{t('checkout_you_save').replace('{amount}', formatPrice(discount))}</AppText>
                  </View>
                )}
              </View>

              <AppText style={styles.sectionTitle} accessibilityRole="header">{t('checkout_voucher_details_title')}</AppText>
              <View style={styles.fact}>
                <LineIcon name="calendar" size={15} color={colors.brand} strokeWidth={2} />
                <AppText style={styles.factText}>{t('checkout_validity').replace('{days}', String(order.validityDays))}</AppText>
              </View>
              {!!order.redemptionTerms && (
                <View style={styles.termsBox}>
                  <AppText style={styles.termsLabel}>{t('voucher_redemption_terms_label')}</AppText>
                  <AppText style={styles.terms}>{order.redemptionTerms}</AppText>
                </View>
              )}

              <View style={styles.divider} />
              <AppText style={styles.sectionTitle} accessibilityRole="header">{t('checkout_cancellation_title')}</AppText>
              <AppText style={styles.body}>{t('checkout_cancellation_body').replace('{fee}', formatPrice(fee))}</AppText>
            </View>
          </ScrollView>

          {/* Pinned above the home indicator. */}
          <View style={[styles.actionBar, { paddingBottom: Math.max(insets.bottom, 12) }]}>
            {payError && <Notice message={payError} />}
            <AppText style={styles.consent}>
              <ConsentText
                template={t('checkout_agree').replace('{price}', formatPrice(order.amount))}
                t={t}
                onOpen={(path) => router.push(`/settings${path}` as Href)}
              />
            </AppText>
            <Button
              label={t('checkout_pay_button').replace('{price}', formatPrice(order.amount))}
              onPress={pay}
              busy={paying}
              large
            />
          </View>
        </>
      )}

      {paying && (
        <View style={styles.overlay} accessibilityViewIsModal accessibilityLiveRegion="polite">
          <View style={styles.overlayCard}>
            <ActivityIndicator color={colors.brand} size="large" />
            <AppText style={styles.overlayText}>{t('checkout_processing')}</AppText>
          </View>
        </View>
      )}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24, paddingBottom: 48 },
  loadingText: { fontSize: 14, color: colors.textMuted, marginTop: 12, textAlign: 'center' },
  stateIcon: { width: 52, height: 52, borderRadius: radius.pill, backgroundColor: colors.successBg, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  // textAlign overrides AppText's reading-direction alignment: these states are centred.
  stateTitle: { fontSize: 18, fontWeight: '700', color: colors.heading, textAlign: 'center', marginBottom: 6 },
  stateSub: { fontSize: 14, lineHeight: 21, color: colors.body, textAlign: 'center' },
  stateAction: { marginTop: 20, alignSelf: 'stretch' },
  content: { paddingHorizontal: 16, paddingTop: 4, paddingBottom: 24 },
  card: { backgroundColor: colors.white, borderRadius: 24, borderWidth: 1, borderColor: colors.border, padding: 20 },
  offerRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 14 },
  thumb: { width: 72, height: 72, borderRadius: radius.lg, overflow: 'hidden', backgroundColor: colors.brandTint },
  offerText: { flex: 1, minWidth: 0 },
  business: { fontSize: 12, fontWeight: '700', color: colors.brand, letterSpacing: 1, textTransform: 'uppercase' },
  offerTitle: { fontSize: 17, lineHeight: 23, fontWeight: '700', color: colors.heading, marginTop: 4 },
  priceBox: { marginTop: 20, padding: 16, borderRadius: radius.lg, backgroundColor: colors.brandTint, borderWidth: 1, borderColor: '#dce8ff', gap: 8 },
  priceRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  priceLabel: { fontSize: 14, color: colors.textMuted },
  struck: { textDecorationLine: 'line-through' },
  // Web: text-emerald-700.
  discountValue: { fontSize: 14, fontWeight: '600', color: '#047857' },
  totalRow: { alignItems: 'flex-end', paddingTop: 4 },
  totalLabel: { flexShrink: 1, fontSize: 16, fontWeight: '700', color: colors.heading },
  totalValue: { fontSize: 28, fontWeight: '800', color: colors.brand },
  vatNote: { fontSize: 12, color: colors.textMuted },
  savings: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    backgroundColor: colors.successBg,
    borderWidth: 1,
    borderColor: colors.successBorder,
    borderRadius: radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  savingsText: { fontSize: 13, fontWeight: '700', color: colors.success },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: colors.heading, marginTop: 20, marginBottom: 8 },
  fact: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  factText: { flex: 1, fontSize: 14, color: colors.body },
  termsBox: { marginTop: 12, padding: 12, borderRadius: radius.md, backgroundColor: colors.background },
  termsLabel: { fontSize: 12, fontWeight: '700', color: colors.textStrong, marginBottom: 4 },
  terms: { fontSize: 13, lineHeight: 19, color: colors.body },
  divider: { height: 1, backgroundColor: colors.borderLight, marginTop: 20 },
  body: { fontSize: 14, lineHeight: 21, color: colors.body },
  actionBar: {
    paddingHorizontal: 16,
    paddingTop: 12,
    backgroundColor: colors.white,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
  },
  consent: { fontSize: 12, lineHeight: 18, color: colors.body, textAlign: 'center', marginBottom: 10 },
  overlay: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(11, 27, 61, 0.45)',
  },
  overlayCard: { minWidth: 200, alignItems: 'center', gap: 14, paddingHorizontal: 28, paddingVertical: 24, borderRadius: 20, backgroundColor: colors.white },
  overlayText: { fontSize: 15, fontWeight: '600', color: colors.heading, textAlign: 'center' },
})

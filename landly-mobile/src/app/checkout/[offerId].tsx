import { useCallback, useEffect, useRef, useState } from 'react'
import { superTavHeadline } from '@shared/offers/superTav'
import { ScrollView, StyleSheet, View } from 'react-native'
import { router, Stack, useLocalSearchParams, type Href } from 'expo-router'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
import { getOffer, type OfferDocument } from '@shared/firebase/offers'
import { subscribeToOrder } from '@shared/firebase/orders'
import { getClaimedPoolIds } from '@shared/firebase/vouchers'
import { useAuth } from '@shared/firebase/useAuth'
import { formatPrice, priceDifference } from '@shared/format'
import type { TranslationKey } from '@shared/i18n/translations'
import { confirmPayment, initiateCheckout, settleSandboxOrder, type CheckoutFailure, type CheckoutOrder } from '@shared/payments/checkoutClient'
import type { CardFrameErrorCode, CardFrameEvent } from '@shared/payments/hostedFieldsProtocol'
import { cancellationFeeAgorot } from '@shared/payments/voucherTerms'
import { checkoutBack, checkoutSwipeAllowed } from '@shared/navigation/backGuard'
import { localizeText } from '@shared/i18n/contentTranslation'
import { localizedBusinessName } from '@shared/business/businessText'
import { isPooled } from '@shared/inventory/types'
import { RAAYONIT_ISSUER } from '@shared/payments/issuer'
import AppText from '../../components/AppText'
import BrandLoader from '../../components/BrandLoader'
import Button from '../../components/Button'
import ComingSoonNotice from '../../components/ComingSoonNotice'
import ConsentText from '../../components/ConsentText'
import LineIcon from '../../components/LineIcon'
import Notice from '../../components/Notice'
import IssuerAttribution from '../../components/IssuerAttribution'
import PurchaseMedia from '../../components/PurchaseMedia'
import ScreenHeader from '../../components/ScreenHeader'
import TranzilaPaymentStep from '../../components/TranzilaPaymentStep'
import { useLang } from '../../i18n/LangProvider'
import { API_BASE_URL } from '../../lib/env'
import { cachedOffer } from '../../lib/openOffer'
import { lockedBackOptions } from '../../lib/pageFlip'
import { useFocusedBackGuard } from '../../lib/useBackGuard'
import { colors, radius } from '../../theme'

// Pauses between asks to /api/payments/confirm while Tranzila has not answered yet.
const CONFIRM_DELAYS_MS = [1500, 2500, 4000, 6000, 8000, 10000]
// Ask for a new Handshake (thtk) this long before the old one lapses.
const REFRESH_MARGIN_MS = 60_000

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
// (components/TranzilaPaymentStep.tsx: Tranzila Hosted Fields in an in-app
// WebView) while this screen listens to the order until the server, having
// verified the transaction with Tranzila, marks it paid. When the card is
// charged the screen asks the server to confirm (/api/payments/confirm); the
// Handshake (thtk) is renewed before its 20 minutes lapse. Either way a success replaces
// this screen with the order confirmation (app/order-success/[orderId].tsx),
// so back from there lands on the offer, now "claimed", never on checkout.
// While a payment is in flight the dimmed overlay holds the screen: no swipe
// back, no Android back, no second tap.
// A render error here shows the retry card; the rest of the app stays up.
export { default as ErrorBoundary } from '../../components/RouteErrorBoundary'

export default function CheckoutScreen() {
  const { t, lang } = useLang()
  const insets = useSafeAreaInsets()
  const { offerId, variant } = useLocalSearchParams<{ offerId: string; variant?: string }>()
  // The voucher value picked on a multi-denomination offer (a pool id); the server prices from its own list.
  const variantPoolId = typeof variant === 'string' && variant ? variant : null
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
  // Live card step: the charge is in flight or being confirmed (locks back like `paying`, without the dimmed overlay that would hide a 3-D Secure challenge).
  const [cardBusy, setCardBusy] = useState(false)
  const [cardConfirming, setCardConfirming] = useState(false)
  const [cardError, setCardError] = useState<CardFrameErrorCode | null>(null)
  const [cardDelayed, setCardDelayed] = useState(false)
  const confirming = useRef(false)
  const refreshing = useRef(false)
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
    () => (uid && offerId
      ? getClaimedPoolIds(uid, offerId, null).then((c) => (variantPoolId ? c.pools.includes(variantPoolId) : c.any)).catch(() => false)
      : Promise.resolve(false)),
    [uid, offerId, variantPoolId]
  )

  // A perk that cannot be bought yet (no live payment gateway) never starts an order.
  const comingSoon = offer?.comingSoon === true
  useEffect(() => {
    if (!user || !offerId || comingSoon) return
    let cancelled = false
    ;(async () => {
      try {
        const result = await initiateCheckout(await user.getIdToken(), offerId, { variantPoolId }, API_BASE_URL)
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
  }, [user, offerId, attempt, isClaimed, failureMessage, variantPoolId, comingSoon])

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

  // A new Handshake for the same frozen order (idempotent on the server); the card fields keep what the member typed.
  const refreshPayment = useCallback(async () => {
    if (!user || !offerId || refreshing.current) return
    refreshing.current = true
    try {
      const result = await initiateCheckout(await user.getIdToken(), offerId, { acceptTerms: true, variantPoolId }, API_BASE_URL)
      if (result.ok) setOrder(result.data)
    } catch {
      // The next Pay tap on the fields reports an expired session, which asks again.
    } finally {
      refreshing.current = false
    }
  }, [user, offerId, variantPoolId])

  const expiresAtMs = order?.payment?.expiresAtMs
  useEffect(() => {
    if (step !== 'payment' || !expiresAtMs) return
    const timer = setTimeout(() => { void refreshPayment() }, Math.max(0, expiresAtMs - REFRESH_MARGIN_MS - Date.now()))
    return () => clearTimeout(timer)
  }, [step, expiresAtMs, refreshPayment])

  // The charge went through in Tranzila's fields: ask the server to confirm it. Only the order id is sent; the server asks
  // Tranzila what it holds and settles, and the order listener above moves the member on.
  const confirmCharge = useCallback(async () => {
    if (!user || !orderId || confirming.current) return
    confirming.current = true
    setCardConfirming(true)
    setCardDelayed(false)
    try {
      for (let i = 0; i <= CONFIRM_DELAYS_MS.length && !completed.current; i++) {
        const result = await confirmPayment(await user.getIdToken(), orderId, API_BASE_URL)
        if (result.ok && result.data.status === 'paid') return complete(orderId)
        if (result.ok && result.data.status === 'failed') { setCardError('declined'); setCardBusy(false); return }
        if (!result.ok && (result.reason === 'unauthorized' || result.reason === 'conflict')) break
        if (i < CONFIRM_DELAYS_MS.length) await new Promise((r) => setTimeout(r, CONFIRM_DELAYS_MS[i]))
      }
      // Tranzila has not confirmed yet: stay here (the order listener still moves the member on) and never invite a second charge.
      if (!completed.current) setCardDelayed(true)
    } catch {
      if (!completed.current) setCardDelayed(true)
    } finally {
      confirming.current = false
      setCardConfirming(false)
    }
  }, [user, orderId, complete])

  const onCardEvent = useCallback((event: CardFrameEvent) => {
    if (event.type === 'submitting') { setCardBusy(true); setCardError(null) }
    else if (event.type === 'charged') void confirmCharge()
    else if (event.type === 'error') {
      setCardBusy(false)
      if (event.code === 'thtk_expired') void refreshPayment()
    }
  }, [confirmCharge, refreshPayment])

  // Android's back button waits for the payment, like the swipe and the header,
  // and on the card step returns to the summary instead of leaving the checkout.
  const locked = paying || cardBusy
  const backAction = checkoutBack({ paying: locked, step })
  const swipeAllowed = checkoutSwipeAllowed({ paying: locked, step })
  useFocusedBackGuard(() => {
    if (backAction === 'to-summary') setStep('summary')
    return backAction !== 'default'
  })

  const pay = async () => {
    if (!user || !offerId || !order || busy.current) return
    busy.current = true
    setPaying(true)
    setPayError(null)
    try {
      const idToken = await user.getIdToken()
      const accepted = await initiateCheckout(idToken, offerId, { acceptTerms: true, variantPoolId }, API_BASE_URL)
      if (!accepted.ok) {
        if (accepted.reason === 'conflict' && (await isClaimed())) setClaimed(true)
        else setPayError(failureMessage(accepted.reason))
        return
      }
      setOrder(accepted.data)
      if (!accepted.data.sandbox) {
        // A fresh card step: nothing left over from an earlier visit.
        setCardBusy(false)
        setCardError(null)
        setCardDelayed(false)
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

  const orderHeadline = order ? superTavHeadline(order, t('super_tav_headline')) : null
  const discount = order?.originalPrice ? priceDifference(order.originalPrice, order.amount) : 0
  const fee = order ? cancellationFeeAgorot(Math.round(order.amount * 100)) / 100 : 0
  const backFallback: Href = offerId ? { pathname: '/offer/[offerId]', params: { offerId } } : '/perks'

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      {/* Swipe-back only on the summary: not mid-payment, not on the card step (iOS drag, Android drag and OS edge alike). */}
      <Stack.Screen options={swipeAllowed ? { gestureEnabled: true, fullScreenGestureEnabled: true } : lockedBackOptions} />
      <ScreenHeader
        title={t('checkout_title')}
        fallback={backFallback}
        onBack={backAction === 'default' ? undefined : () => backAction === 'to-summary' && setStep('summary')}
      />

      {comingSoon ? (
        <View style={styles.centered}>
          <ComingSoonNotice generic />
          <Button label={t('onb_back')} variant="secondary" onPress={() => router.back()} />
        </View>
      ) : claimed ? (
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
          <BrandLoader size="md" decorative />
          <AppText style={styles.loadingText}>{t('checkout_loading')}</AppText>
        </View>
      ) : step === 'payment' ? (
        <ScrollView showsVerticalScrollIndicator={false} showsHorizontalScrollIndicator={false} contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]}>
          <TranzilaPaymentStep
            offerTitle={localizeText(order.offerTitle, order.translations, lang, 'title').text}
            amount={order.amount}
            payment={order.payment ?? null}
            busy={cardConfirming}
            error={cardError}
            delayed={cardDelayed}
            onEvent={onCardEvent}
            onBack={() => setStep('summary')}
          />
        </ScrollView>
      ) : (
        <>
          <ScrollView showsVerticalScrollIndicator={false} showsHorizontalScrollIndicator={false} contentContainerStyle={styles.content} contentInsetAdjustmentBehavior="automatic">
            <View style={styles.card}>
              {/* Who and what: photo (or the category panel), business, offer. */}
              <View style={styles.offerRow}>
                <PurchaseMedia source={{ order, offer }} category={offer?.category} />
                <View style={styles.offerText}>
                  {/* A Super Tav leads with its value ("Super Tav — ₪100 Value"), the business on the line below. */}
                  {orderHeadline ? (
                    <>
                      <AppText style={[styles.offerTitle, styles.offerTitleFirst]} accessibilityRole="header">{orderHeadline}</AppText>
                      <AppText style={[styles.business, styles.businessBelow]} numberOfLines={1}>{localizedBusinessName(order, lang).text}</AppText>
                    </>
                  ) : (
                    <>
                      <AppText style={styles.business} numberOfLines={1}>{localizedBusinessName(order, lang).text}</AppText>
                      <AppText style={styles.offerTitle} accessibilityRole="header">{localizeText(order.offerTitle, order.translations, lang, 'title').text}</AppText>
                    </>
                  )}
                </View>
              </View>

              {(order.fulfillmentType === 'raayonit_pool' || (!!offer && isPooled(offer.fulfillmentType))) && (
                <View style={styles.issuer}>
                  <IssuerAttribution issuer={RAAYONIT_ISSUER} note={t('voucher_valid_years')} />
                </View>
              )}

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
                <AppText style={styles.factText}>{offer?.fulfillmentType === 'raayonit_pool' ? t('voucher_valid_years') : t('checkout_validity').replace('{days}', String(order.validityDays))}</AppText>
              </View>
              {!!order.redemptionTerms && (
                <View style={styles.termsBox}>
                  <AppText style={styles.termsLabel}>{t('voucher_redemption_terms_label')}</AppText>
                  <AppText style={styles.terms}>{localizeText(order.redemptionTerms, order.translations, lang, 'redemptionTerms').text}</AppText>
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
            <BrandLoader size="md" decorative />
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
  offerRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  issuer: { marginTop: 20 },
  offerText: { flex: 1, minWidth: 0 },
  business: { fontSize: 12, fontWeight: '700', color: colors.brand, letterSpacing: 1, textTransform: 'uppercase' },
  offerTitle: { fontSize: 17, lineHeight: 24, fontWeight: '700', color: colors.heading, marginTop: 4 },
  offerTitleFirst: { marginTop: 0 },
  businessBelow: { marginTop: 4 },
  priceBox: { marginTop: 24, padding: 20, borderRadius: radius.lg, backgroundColor: colors.brandTint, borderWidth: 1, borderColor: colors.brandLight, gap: 12 },
  priceRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  priceLabel: { fontSize: 14, color: colors.textMuted },
  struck: { textDecorationLine: 'line-through' },
  // Web: text-emerald-700.
  discountValue: { fontSize: 14, fontWeight: '600', color: colors.discount, fontVariant: ['tabular-nums'] },
  totalRow: { alignItems: 'flex-end', paddingTop: 4 },
  totalLabel: { flexShrink: 1, fontSize: 16, fontWeight: '700', color: colors.heading },
  totalValue: { fontSize: 28, fontWeight: '800', color: colors.brand, fontVariant: ['tabular-nums'] },
  vatNote: { fontSize: 12, lineHeight: 18, color: colors.textMuted },
  savings: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    backgroundColor: colors.successBg,
    borderWidth: 1,
    borderColor: colors.successBorder,
    borderRadius: radius.chip,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  savingsText: { fontSize: 13, fontWeight: '700', color: colors.success, fontVariant: ['tabular-nums'] },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: colors.heading, marginTop: 28, marginBottom: 12 },
  fact: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  factText: { flex: 1, fontSize: 14, color: colors.body },
  termsBox: { marginTop: 16, padding: 16, borderRadius: radius.md, backgroundColor: colors.background },
  termsLabel: { fontSize: 12, fontWeight: '700', color: colors.textStrong, marginBottom: 4 },
  terms: { fontSize: 13, lineHeight: 22, color: colors.body },
  divider: { height: 1, backgroundColor: colors.borderLight, marginTop: 28 },
  body: { fontSize: 14, lineHeight: 22, color: colors.body },
  actionBar: {
    paddingHorizontal: 16,
    paddingTop: 16,
    backgroundColor: colors.white,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
  },
  consent: { fontSize: 12, lineHeight: 22, color: colors.body, textAlign: 'center', marginBottom: 16 },
  overlay: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(11, 27, 61, 0.45)',
  },
  overlayCard: { minWidth: 200, alignItems: 'center', gap: 14, paddingHorizontal: 28, paddingVertical: 24, borderRadius: 20, backgroundColor: colors.white },
  overlayText: { fontSize: 15, fontWeight: '600', color: colors.heading, textAlign: 'center' },
})

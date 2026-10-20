import { useEffect, useRef, useState } from 'react'
import { AccessibilityInfo, ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import * as Clipboard from 'expo-clipboard'
import Animated, { ZoomIn } from 'react-native-reanimated'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
import { getOffer, type OfferDocument } from '@shared/firebase/offers'
import { subscribeToOrder, type OrderDocument } from '@shared/firebase/orders'
import { formatPrice, priceDifference } from '@shared/format'
import { orderReference } from '@shared/payments/orderNumber'
import { localizeText } from '@shared/i18n/contentTranslation'
import { localizedBusinessName } from '@shared/business/businessText'
import AppText from '../../components/AppText'
import Button from '../../components/Button'
import Confetti from '../../components/Confetti'
import LineIcon from '../../components/LineIcon'
import Notice from '../../components/Notice'
import PerkImage from '../../components/PerkImage'
import ScreenHeader from '../../components/ScreenHeader'
import { useLang } from '../../i18n/LangProvider'
import { success, tick } from '../../lib/haptics'
import { webOnly } from '../../lib/webStyles'
import { colors, radius } from '../../theme'

// The check pops in on a spring; Reanimated skips it under Reduce Motion.
const CHECK_IN = ZoomIn.springify().damping(12).stiffness(140)

// The order confirmation (web: /order-success?orderId=…). The checkout
// replaces itself with this screen once the order settles, so back never
// lands on the payment step -- it turns back to the offer, now "claimed".
// Live from Firestore (orders/{orderId}), never from the route alone: a
// pending order shows "confirming", a failed one says so. Once paid: a
// confetti burst and the success haptic (once), the check, the order number
// with copy, what was bought, paid and saved, and the bar pinned above the
// home indicator: the voucher (its id is the order's), My Pass, or back to
// exploring.
export default function OrderSuccessScreen() {
  const { t, lang } = useLang()
  const insets = useSafeAreaInsets()
  const { orderId } = useLocalSearchParams<{ orderId: string }>()
  // undefined while loading; null when missing or someone else's (rules deny both alike).
  const [order, setOrder] = useState<OrderDocument | null | undefined>(undefined)
  const [offer, setOffer] = useState<OfferDocument | null>(null)
  const celebrated = useRef(false)

  useEffect(() => {
    if (!orderId) return
    return subscribeToOrder(orderId, setOrder)
  }, [orderId])

  // The thumbnail is decoration from the live offer; the order holds what was bought.
  const offerId = order?.offerId
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

  const paid = order?.status === 'paid'
  useEffect(() => {
    if (!paid || celebrated.current) return
    celebrated.current = true
    success()
  }, [paid])

  const pending = order === undefined || order?.status === 'pending'
  const discount = paid && order.originalPrice ? priceDifference(order.originalPrice, order.amount) : 0
  const voucherId = paid ? order.voucherId : null

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScreenHeader title={t('success_title')} fallback="/wallet" />

      {pending ? (
        <View style={styles.centered} accessibilityLiveRegion="polite">
          <ActivityIndicator color={colors.brand} />
          <AppText style={styles.stateTitle}>{t('checkout_confirming_title')}</AppText>
          <AppText style={styles.stateSub}>{t('checkout_confirming_sub')}</AppText>
        </View>
      ) : !paid ? (
        <View style={styles.centered}>
          <Notice message={`${t('checkout_failed_title')}. ${t('checkout_failed_sub')}`} />
          <Button label={t('success_to_my_pass')} variant="secondary" onPress={() => router.navigate('/wallet')} />
        </View>
      ) : (
        <>
          <ScrollView contentContainerStyle={styles.content} contentInsetAdjustmentBehavior="automatic">
            <View style={styles.hero} accessibilityLiveRegion="polite">
              <Animated.View entering={CHECK_IN} style={styles.check}>
                <LineIcon name="check" size={34} color={colors.white} strokeWidth={3} />
              </Animated.View>
              <AppText style={styles.title} accessibilityRole="header">{t('success_celebration_title')}</AppText>
              <AppText style={styles.subtitle}>{t('success_subtitle')}</AppText>
            </View>

            {/* What was bought: thumbnail, business and perk, paid and saved. */}
            <View style={styles.card}>
              <View style={styles.perkRow}>
                <View style={styles.thumb}>
                  {offer && <PerkImage uri={offer.imageUrl} category={offer.category} businessName={offer.businessName} />}
                </View>
                <View style={styles.perkText}>
                  <AppText style={styles.business} numberOfLines={1}>{localizedBusinessName(order, lang).text}</AppText>
                  <AppText style={styles.perkTitle}>{localizeText(order.offerTitle, order.translations, lang, 'title').text}</AppText>
                </View>
              </View>
              <View style={styles.paidRow}>
                <AppText style={styles.paidLabel}>{t('success_amount_paid_label')}</AppText>
                <AppText ltr style={styles.paidValue}>{formatPrice(order.amount)}</AppText>
              </View>
              {discount > 0 && (
                <View style={styles.savings}>
                  <LineIcon name="tag" size={13} color={colors.success} strokeWidth={2.2} />
                  <AppText style={styles.savingsText}>{t('checkout_you_save').replace('{amount}', formatPrice(discount))}</AppText>
                </View>
              )}

              <View style={styles.divider} />
              <View style={styles.orderRow}>
                <View style={styles.orderText}>
                  <AppText style={styles.orderLabel}>{t('success_order_number_label')}</AppText>
                  <AppText ltr style={styles.orderId} numberOfLines={1} ellipsizeMode="middle" selectable>
                    {orderReference(order.displayOrderNumber, orderId)}
                  </AppText>
                </View>
                <CopyOrderIdButton value={order.displayOrderNumber ?? orderId} />
              </View>
            </View>

            <View style={styles.ready}>
              <LineIcon name="gift" size={16} color={colors.success} strokeWidth={2.2} />
              <AppText style={styles.readyText}>{t('success_voucher_ready')}</AppText>
            </View>
            <AppText style={styles.receipt}>{t('success_receipt_note')}</AppText>
          </ScrollView>

          {/* Pinned above the home indicator. */}
          <View style={[styles.actionBar, { paddingBottom: Math.max(insets.bottom, 12) }]}>
            {voucherId && (
              <Button
                label={t('success_view_voucher')}
                onPress={() => router.push({ pathname: '/voucher/[voucherId]', params: { voucherId } })}
                large
              />
            )}
            <Button label={t('success_to_my_pass')} variant="secondary" onPress={() => router.navigate('/wallet')} />
            <Pressable
              accessibilityRole="link"
              onPress={() => router.navigate('/')}
              hitSlop={4}
              style={({ pressed }) => [styles.explore, pressed && styles.explorePressed]}
            >
              <AppText style={styles.exploreText}>{t('success_keep_exploring')}</AppText>
            </Pressable>
          </View>
          <Confetti />
        </>
      )}
    </SafeAreaView>
  )
}

// Copies the order number as shown ("#1001"; the bare id for an order settled before numbering).
function CopyOrderIdButton({ value }: { value: string }) {
  const { t } = useLang()
  const [status, setStatus] = useState<'idle' | 'copied' | 'failed'>('idle')

  useEffect(() => {
    if (status === 'idle') return
    AccessibilityInfo.announceForAccessibility(t(status === 'copied' ? 'success_order_id_copied' : 'voucher_copy_failed'))
    const timer = setTimeout(() => setStatus('idle'), 2000)
    return () => clearTimeout(timer)
  }, [status, t])

  const copy = async () => {
    try {
      const copied = await Clipboard.setStringAsync(value)
      if (copied) tick()
      setStatus(copied ? 'copied' : 'failed')
    } catch {
      setStatus('failed')
    }
  }

  return (
    <Pressable
      onPress={copy}
      accessibilityRole="button"
      accessibilityLabel={t('success_copy_order_id')}
      hitSlop={4}
      style={({ pressed }) => [styles.copy, pressed && styles.copyPressed]}
    >
      <LineIcon
        name={status === 'copied' ? 'check' : status === 'failed' ? 'close' : 'copy'}
        size={18}
        color={status === 'failed' ? colors.danger : status === 'copied' ? colors.success : colors.brand}
        strokeWidth={2.2}
      />
    </Pressable>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24, paddingBottom: 48 },
  // textAlign overrides AppText's reading-direction alignment: these states are centred.
  stateTitle: { fontSize: 17, fontWeight: '700', color: colors.heading, textAlign: 'center', marginTop: 16 },
  stateSub: { fontSize: 14, color: colors.body, textAlign: 'center', marginTop: 4 },
  content: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 24 },
  hero: { alignItems: 'center', paddingVertical: 12 },
  check: {
    width: 72,
    height: 72,
    borderRadius: radius.pill,
    backgroundColor: '#10b981',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    borderWidth: 6,
    borderColor: colors.successBorder,
  },
  title: { fontSize: 26, lineHeight: 33, fontWeight: '900', color: colors.heading, textAlign: 'center' },
  subtitle: { fontSize: 15, color: colors.body, textAlign: 'center', marginTop: 4 },
  card: { backgroundColor: colors.white, borderRadius: 24, borderWidth: 1, borderColor: colors.border, padding: 18, marginTop: 20 },
  perkRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  thumb: { width: 64, height: 64, borderRadius: radius.md, overflow: 'hidden', backgroundColor: colors.brandTint },
  perkText: { flex: 1, minWidth: 0 },
  business: { fontSize: 12, fontWeight: '700', color: colors.brand, letterSpacing: 1, textTransform: 'uppercase' },
  perkTitle: { fontSize: 16, lineHeight: 22, fontWeight: '700', color: colors.heading, marginTop: 2 },
  paidRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 16 },
  paidLabel: { fontSize: 14, color: colors.textMuted },
  paidValue: { fontSize: 22, fontWeight: '900', color: colors.heading },
  savings: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    marginTop: 10,
    backgroundColor: colors.successBg,
    borderWidth: 1,
    borderColor: colors.successBorder,
    borderRadius: radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  savingsText: { fontSize: 13, fontWeight: '700', color: colors.success },
  divider: { height: 1, backgroundColor: colors.borderLight, marginVertical: 16 },
  orderRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  orderText: { flex: 1, minWidth: 0 },
  orderLabel: { fontSize: 12, color: colors.textMuted },
  orderId: { fontSize: 14, fontWeight: '600', color: colors.text, fontVariant: ['tabular-nums'], marginTop: 2 },
  copy: {
    width: 48,
    height: 48,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.brandTint,
    ...webOnly({ cursor: 'pointer' }),
  },
  copyPressed: { backgroundColor: colors.brandLight },
  ready: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 20, paddingHorizontal: 8 },
  readyText: { flexShrink: 1, fontSize: 14, fontWeight: '700', color: colors.success, textAlign: 'center' },
  receipt: { fontSize: 12, color: colors.textMuted, textAlign: 'center', marginTop: 6 },
  actionBar: {
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 12,
    backgroundColor: colors.white,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
  },
  explore: { minHeight: 44, alignItems: 'center', justifyContent: 'center', borderRadius: radius.pill, ...webOnly({ cursor: 'pointer' }) },
  explorePressed: { backgroundColor: colors.borderLight },
  exploreText: { fontSize: 15, fontWeight: '700', color: colors.brand, textAlign: 'center' },
})

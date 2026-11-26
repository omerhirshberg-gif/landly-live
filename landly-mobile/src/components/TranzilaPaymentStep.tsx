import { Pressable, StyleSheet, View } from 'react-native'
import { formatPrice } from '@shared/format'
import type { CardFrameErrorCode, CardFrameEvent, CardHolder, HostedPaymentParams } from '@shared/payments/hostedFieldsProtocol'
import AppText from './AppText'
import BrandLoader from './BrandLoader'
import DirectionalIcon from './DirectionalIcon'
import TranzilaCardFrame from './TranzilaCardFrame'
import { useLang } from '../i18n/LangProvider'
import { webOnly } from '../lib/webStyles'
import { colors, radius } from '../theme'

// Native counterpart of components/checkout/TranzilaPaymentWidget.tsx: the card step of the in-app checkout
// (app/checkout/[offerId].tsx) for a live terminal order. Tranzila's Hosted Fields run in an in-app WebView
// (TranzilaCardFrame), never the system browser, so the member stays in GoLandly's checkout. The checkout screen listens to
// the order, so the server verifying the transaction with Tranzila -- not this component -- moves the member on to their
// voucher; nothing here confirms a payment.
export default function TranzilaPaymentStep({
  offerTitle,
  amount,
  payment,
  busy,
  error,
  delayed,
  cardHolder,
  onEvent,
  onBack,
}: {
  offerTitle: string
  amount: number
  /** The Handshake and notify URL for this order; null until the server issues them. */
  payment: HostedPaymentParams | null
  /** The app is confirming the charge with the server. */
  busy: boolean
  error: CardFrameErrorCode | null
  /** Tranzila has not confirmed yet: tell the member not to pay again. */
  delayed: boolean
  /** From the signed-in member's profile; forwarded to Tranzila as the 3-D Secure cardholder name and email. */
  cardHolder?: CardHolder
  onEvent: (event: CardFrameEvent) => void
  onBack: () => void
}) {
  const { t } = useLang()
  const priceLabel = formatPrice(amount)

  return (
    <View style={styles.card}>
      <View style={styles.summary}>
        <AppText autoDir style={styles.offer} numberOfLines={2}>{offerTitle}</AppText>
        <AppText ltr style={styles.price}>{priceLabel}</AppText>
      </View>

      {payment ? (
        <TranzilaCardFrame payment={payment} priceLabel={priceLabel} busy={busy} error={error} cardHolder={cardHolder} onEvent={onEvent} />
      ) : (
        <View style={styles.waiting} accessibilityRole="progressbar" accessibilityLabel={t('checkout_card_loading')}>
          <BrandLoader size="md" decorative />
          <AppText style={styles.waitingText}>{t('checkout_card_loading')}</AppText>
        </View>
      )}

      {busy && !delayed && <AppText style={styles.status} accessibilityLiveRegion="polite">{t('checkout_card_confirming')}</AppText>}
      {delayed && <AppText style={[styles.status, styles.delayed]} accessibilityLiveRegion="polite">{t('checkout_card_confirm_delayed')}</AppText>}

      <Pressable
        accessibilityRole="button"
        disabled={busy}
        onPress={onBack}
        hitSlop={8}
        style={({ pressed }) => [styles.back, busy && styles.backDisabled, pressed && styles.backPressed]}
      >
        <DirectionalIcon name="chevronStart" size={16} color={colors.brand} strokeWidth={2.2} />
        <AppText style={styles.backText}>{t('checkout_back_to_summary')}</AppText>
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.white,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 20,
  },
  summary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 20,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: radius.lg,
    backgroundColor: colors.brandTint,
    borderWidth: 1,
    borderColor: colors.brandLight,
  },
  offer: { flex: 1, fontSize: 14, fontWeight: '600', color: colors.text },
  price: { fontSize: 18, fontWeight: '800', color: colors.brand, fontVariant: ['tabular-nums'] },
  waiting: { alignItems: 'center', gap: 12, paddingVertical: 40 },
  waitingText: { fontSize: 14, color: colors.textMuted, textAlign: 'center' },
  status: { marginTop: 12, fontSize: 14, lineHeight: 21, color: colors.body },
  delayed: { color: colors.danger, fontWeight: '600' },
  back: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 48,
    paddingHorizontal: 12,
    marginTop: 12,
    borderRadius: radius.action,
    ...webOnly({ cursor: 'pointer' }),
  },
  backDisabled: { opacity: 0.5 },
  backPressed: { backgroundColor: colors.borderLight },
  backText: { fontSize: 15, fontWeight: '700', color: colors.brand },
})

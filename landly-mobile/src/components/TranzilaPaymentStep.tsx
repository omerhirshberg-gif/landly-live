import { Pressable, StyleSheet, View } from 'react-native'
import { formatPrice } from '@shared/format'
import AppText from './AppText'
import LineIcon from './LineIcon'
import { useLang } from '../i18n/LangProvider'
import { webOnly } from '../lib/webStyles'
import { colors, radius } from '../theme'

// Native counterpart of components/checkout/TranzilaPaymentWidget.tsx: the
// card step of the in-app checkout (app/checkout/[offerId].tsx) for a live
// terminal order. Until Tranzila credentials arrive it says payment is coming
// soon; then its body becomes Tranzila's hosted fields in an in-app WebView
// (never the system browser). The checkout screen already listens to the
// order, so the webhook settling it -- not this component -- moves the member
// on to their voucher; nothing here confirms a payment.
export default function TranzilaPaymentStep({
  offerTitle,
  amount,
  onBack,
}: {
  offerTitle: string
  amount: number
  onBack: () => void
}) {
  const { t, isRtl } = useLang()

  return (
    <View style={styles.card}>
      <View style={styles.icon}>
        <LineIcon name="lock" size={24} color={colors.brand} strokeWidth={2} />
      </View>
      <AppText accessibilityRole="header" style={styles.title}>{t('checkout_payment_coming_soon_title')}</AppText>
      <AppText style={styles.sub}>{t('checkout_payment_coming_soon_sub')}</AppText>
      <View style={styles.line}>
        <AppText style={styles.lineText} numberOfLines={2}>{offerTitle}</AppText>
        <AppText ltr style={styles.lineText}>{formatPrice(amount)}</AppText>
      </View>
      <Pressable
        accessibilityRole="button"
        onPress={onBack}
        hitSlop={8}
        style={({ pressed }) => [styles.back, pressed && styles.backPressed]}
      >
        <LineIcon name="chevronStart" size={16} color={colors.brand} strokeWidth={2.4} flip={isRtl} />
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
    padding: 24,
    alignItems: 'center',
  },
  icon: { width: 52, height: 52, borderRadius: radius.pill, backgroundColor: colors.brandTint, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  // textAlign overrides AppText's reading-direction alignment: the panel is centred.
  title: { fontSize: 18, fontWeight: '700', color: colors.heading, textAlign: 'center', marginBottom: 8 },
  sub: { fontSize: 14, lineHeight: 21, color: colors.textMuted, textAlign: 'center' },
  line: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 16, maxWidth: '100%' },
  lineText: { flexShrink: 1, fontSize: 14, fontWeight: '600', color: colors.text },
  back: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 48,
    paddingHorizontal: 16,
    marginTop: 12,
    borderRadius: radius.pill,
    ...webOnly({ cursor: 'pointer' }),
  },
  backPressed: { backgroundColor: colors.borderLight },
  backText: { fontSize: 15, fontWeight: '700', color: colors.brand },
})

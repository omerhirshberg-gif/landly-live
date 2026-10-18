import { useState } from 'react'
import { StyleSheet, View } from 'react-native'
import { router } from 'expo-router'
import Svg, { Path } from 'react-native-svg'
import type { VoucherDocument } from '@shared/firebase/vouchers'
import { formatLongDate } from '@shared/format'
import { REDEMPTION_METHOD_LABEL_KEYS } from '@shared/offers/redemption'
import { useLang } from '../i18n/LangProvider'
import AppText from './AppText'
import LineIcon from './LineIcon'
import { REDEMPTION_METHOD_ICONS } from './OfferCard'
import ScalePressable from './ScalePressable'
import VoucherThumb from './VoucherThumb'
import { webOnly } from '../lib/webStyles'
import { colors, radius } from '../theme'

type Voucher = VoucherDocument & { id: string }

// One active voucher as a compact card — same as the web member area's
// PerksTab card (components/member/PerksTab.tsx): the offer's thumbnail on
// the start side, then business, offer, method and validity. The whole card
// is the button and presses in slightly; the pill at its foot only says what
// tapping does. It pushes the voucher's own screen
// (app/voucher/[voucherId].tsx), where the QR code and the numeric code each
// stay hidden until tapped.
export default function VoucherPass({ voucher }: { voucher: Voucher }) {
  const { t, lang, isRtl } = useLang()
  // Read once per mount, since render must stay pure.
  const [now] = useState(Date.now)
  const expired = !!voucher.expiresAt && voucher.expiresAt.getTime() < now
  const validity = voucher.expiresAt
    ? t(expired ? 'voucher_expired_on' : 'voucher_valid_until').replace('{date}', formatLongDate(voucher.expiresAt, lang))
    : null

  return (
    <ScalePressable
      pressedScale={0.98}
      accessibilityRole="button"
      accessibilityLabel={[voucher.businessName, voucher.offerTitle, validity, t('voucher_show_button')].filter(Boolean).join(', ')}
      onPress={() => router.push({ pathname: '/voucher/[voucherId]', params: { voucherId: voucher.id } })}
      style={styles.card}
    >
      <View style={styles.top}>
        <VoucherThumb voucher={voucher} />
        <View style={styles.text}>
          <AppText style={styles.business} numberOfLines={1}>{voucher.businessName}</AppText>
          <AppText style={styles.title} numberOfLines={2}>{voucher.offerTitle}</AppText>
          <View style={styles.methodChip}>
            <LineIcon name={REDEMPTION_METHOD_ICONS[voucher.redemptionMethod]} size={12} color={colors.brand} strokeWidth={2.2} />
            <AppText style={styles.methodText}>{t(REDEMPTION_METHOD_LABEL_KEYS[voucher.redemptionMethod])}</AppText>
          </View>
        </View>
      </View>
      {validity && (
        <View style={styles.validityRow}>
          <LineIcon name="calendar" size={14} color={expired ? colors.danger : colors.textMuted} />
          <AppText style={[styles.validity, expired && styles.expired]}>{validity}</AppText>
        </View>
      )}
      {/* Looks like the primary button, but the whole card is the target. */}
      <View style={styles.cta}>
        <AppText style={styles.ctaText}>{t('voucher_show_button')}</AppText>
        <Svg
          width={16}
          height={16}
          viewBox="0 0 24 24"
          fill="none"
          stroke={colors.white}
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          style={isRtl && styles.flip}
        >
          <Path d="M5 12h14M12 5l7 7-7 7" />
        </Svg>
      </View>
    </ScalePressable>
  )
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.borderLight,
    padding: 16,
    marginBottom: 12,
    ...webOnly({ cursor: 'pointer' }),
  },
  top: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  text: { flex: 1, minWidth: 0 },
  business: { fontSize: 16, lineHeight: 22, fontWeight: '700', color: colors.heading },
  title: { fontSize: 14, lineHeight: 20, color: colors.body, marginTop: 2 },
  methodChip: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: colors.brandTint,
    borderRadius: radius.pill,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginTop: 6,
  },
  methodText: { fontSize: 12, fontWeight: '600', color: colors.brand },
  validityRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12 },
  validity: { fontSize: 13, fontWeight: '600', color: colors.textMuted },
  expired: { color: colors.danger },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minHeight: 48,
    marginTop: 14,
    borderRadius: radius.pill,
    backgroundColor: colors.brand,
  },
  ctaText: { fontSize: 15, fontWeight: '700', color: colors.white },
  flip: { transform: [{ scaleX: -1 }] },
})

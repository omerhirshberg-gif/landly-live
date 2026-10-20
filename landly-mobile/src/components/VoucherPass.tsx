import { useState } from 'react'
import { StyleSheet, View } from 'react-native'
import { router } from 'expo-router'
import type { VoucherDocument } from '@shared/firebase/vouchers'
import { formatLongDate } from '@shared/format'
import { REDEMPTION_METHOD_LABEL_KEYS } from '@shared/offers/redemption'
import { useLang } from '../i18n/LangProvider'
import { localizeText } from '@shared/i18n/contentTranslation'
import { localizedBusinessName } from '@shared/business/businessText'
import AppText from './AppText'
import ContentText from './ContentText'
import LineIcon from './LineIcon'
import { REDEMPTION_METHOD_ICONS } from './OfferCard'
import ScalePressable from './ScalePressable'
import VoucherThumb from './VoucherThumb'
import { webOnly } from '../lib/webStyles'
import { colors, radius } from '../theme'

type Voucher = VoucherDocument & { id: string }

// One active voucher as a compact card — same as the web member area's
// PerksTab card (components/member/PerksTab.tsx): the offer's thumbnail on
// the start side, then business, offer, method and validity, and a chevron on
// the end side (pointing left in Hebrew) that says it opens. The whole card is
// the button and presses in slightly; there's no separate button. It pushes
// the voucher's own screen
// (app/voucher/[voucherId].tsx), where the QR code and the numeric code each
// stay hidden until tapped.
export default function VoucherPass({ voucher }: { voucher: Voucher }) {
  const { t, lang, isRtl } = useLang()
  const title = localizeText(voucher.offerTitle, voucher.translations, lang, 'title')
  const name = localizedBusinessName(voucher, lang)
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
      accessibilityLabel={[name.text, title.text, validity, t('voucher_show_button')].filter(Boolean).join(', ')}
      onPress={() => router.push({ pathname: '/voucher/[voucherId]', params: { voucherId: voucher.id } })}
      style={styles.card}
    >
      <View style={styles.row}>
        <VoucherThumb voucher={voucher} />
        <View style={styles.text}>
          <AppText style={styles.business} numberOfLines={1}>{name.text}</AppText>
          <ContentText contentLang={title.lang} style={styles.title} numberOfLines={2}>{title.text}</ContentText>
          <View style={styles.methodChip}>
            <LineIcon name={REDEMPTION_METHOD_ICONS[voucher.redemptionMethod]} size={12} color={colors.brand} strokeWidth={2.2} />
            <AppText style={styles.methodText}>{t(REDEMPTION_METHOD_LABEL_KEYS[voucher.redemptionMethod])}</AppText>
          </View>
          {validity && (
            <View style={styles.validityRow}>
              <LineIcon name="calendar" size={14} color={expired ? colors.danger : colors.textMuted} />
              <AppText style={[styles.validity, expired && styles.expired]}>{validity}</AppText>
            </View>
          )}
        </View>
        <LineIcon name="chevronEnd" size={20} color={colors.textFaint} strokeWidth={2.2} flip={isRtl} />
      </View>
    </ScalePressable>
  )
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border, // web: border-line
    padding: 16,
    marginBottom: 12,
    ...webOnly({ cursor: 'pointer' }),
  },
  // Thumbnail, text and chevron, centred on one line (minimum 48pt tall).
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 48 },
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
  validityRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 },
  validity: { fontSize: 13, fontWeight: '600', color: colors.textMuted },
  expired: { color: colors.danger },
})

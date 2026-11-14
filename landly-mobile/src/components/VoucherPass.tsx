import { useState } from 'react'
import { StyleSheet, View } from 'react-native'
import { router } from 'expo-router'
import type { VoucherDocument } from '@shared/firebase/vouchers'
import { formatLongDate } from '@shared/format'
import { voucherDestination } from '@shared/member/voucherDestination'
import { useLang } from '../i18n/LangProvider'
import { localizeText } from '@shared/i18n/contentTranslation'
import { localizedBusinessName } from '@shared/business/businessText'
import { locationNoticeKind } from '@shared/offers/locationVisibility'
import AppText from './AppText'
import { PerkReachLine } from './PerkReach'
import ContentText from './ContentText'
import LineIcon from './LineIcon'
import ScalePressable from './ScalePressable'
import TicketTear from './TicketTear'
import VoucherCover from './VoucherCover'
import { impact } from '../lib/haptics'
import { webOnly } from '../lib/webStyles'
import { colors, radius } from '../theme'

type Voucher = VoucherDocument & { id: string }

const DAY_MS = 24 * 60 * 60 * 1000
/** Under a week left: the validity line turns amber. */
const SOON_DAYS = 7

// One active voucher as a pass card (web: components/member/PerksTab.tsx): the
// offer's 16:9 cover with the business's squircle logo across its bottom start
// corner, then the business, the deal and, below a perforated tear-line with a
// bite out of each side edge, when it runs out (amber under a week, red once
// it has) and a "View voucher" pill. The whole card is the button: it presses
// in with a light tap and pushes the voucher's own screen
// (app/voucher/[voucherId].tsx), where the QR code and the numeric code each
// stay hidden until tapped. The chevron points left in Hebrew.
export default function VoucherPass({ voucher }: { voucher: Voucher }) {
  const { t, lang, isRtl } = useLang()
  const title = localizeText(voucher.offerTitle, voucher.translations, lang, 'title')
  const name = localizedBusinessName(voucher, lang)
  // Read once per mount, since render must stay pure.
  const [now] = useState(Date.now)
  const expired = !!voucher.expiresAt && voucher.expiresAt.getTime() < now
  const soon = !!voucher.expiresAt && !expired && voucher.expiresAt.getTime() - now < SOON_DAYS * DAY_MS
  const validity = voucher.expiresAt
    ? t(expired ? 'voucher_expired_on' : 'voucher_valid_until').replace('{date}', formatLongDate(voucher.expiresAt, lang))
    : null
  const { place } = voucherDestination(voucher, lang)
  const tone = expired ? colors.danger : soon ? colors.warningIcon : colors.textMuted

  return (
    <ScalePressable
      pressedScale={0.98}
      accessibilityRole="button"
      accessibilityLabel={[name.text, title.text, validity, t('voucher_show_button')].filter(Boolean).join(', ')}
      onPress={() => {
        impact()
        router.push({ pathname: '/voucher/[voucherId]', params: { voucherId: voucher.id } })
      }}
      style={styles.card}
    >
      <VoucherCover voucher={voucher} name={name.text} maxHeight={148} />
      <View style={styles.body}>
        <AppText style={styles.business} numberOfLines={1}>{name.text}</AppText>
        <ContentText contentLang={title.lang} style={styles.title} numberOfLines={2}>{title.text}</ContentText>
        {!place && locationNoticeKind(voucher) !== null && (
          <View style={styles.address}>
            <PerkReachLine offer={voucher} compact />
          </View>
        )}
        {!!place && (
          <View style={styles.address}>
            <LineIcon name="pin" size={13} color={colors.textFaint} strokeWidth={1.75} />
            <AppText style={styles.addressText} numberOfLines={1}>{place}</AppText>
          </View>
        )}
      </View>
      <TicketTear />
      <View style={styles.footer}>
        {validity ? (
          <View style={styles.validityRow}>
            <LineIcon name="clock" size={14} color={tone} strokeWidth={1.75} />
            <AppText style={[styles.validity, { color: tone }]} numberOfLines={1}>{validity}</AppText>
          </View>
        ) : (
          <View style={styles.validityRow} />
        )}
        <View style={styles.view}>
          <AppText style={styles.viewText}>{t('voucher_show_button')}</AppText>
          <LineIcon name="chevronEnd" size={16} color={colors.brand} strokeWidth={2.2} flip={isRtl} />
        </View>
      </View>
    </ScalePressable>
  )
}

const styles = StyleSheet.create({
  // Not clipped: the shadow and the tear-line's bites draw outside the edge.
  card: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.borderLight,
    marginBottom: 14,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.05,
    shadowRadius: 14,
    elevation: 2,
    ...webOnly({ cursor: 'pointer' }),
  },
  // Clears the logo's 16pt overhang.
  body: { paddingHorizontal: 14, paddingTop: 24, paddingBottom: 12 },
  business: { fontSize: 17, lineHeight: 23, fontWeight: '800', color: colors.heading },
  title: { fontSize: 14, lineHeight: 20, color: colors.body, marginTop: 2 },
  address: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 8 },
  addressText: { flex: 1, fontSize: 12, lineHeight: 16, color: colors.textFaint },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, paddingHorizontal: 14, paddingTop: 10, paddingBottom: 14 },
  validityRow: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 6 },
  validity: { flexShrink: 1, fontSize: 12, lineHeight: 16, fontWeight: '600' },
  view: {
    flexShrink: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    minHeight: 32,
    paddingStart: 12,
    paddingEnd: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.brandTint,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  viewText: { fontSize: 13, lineHeight: 18, fontWeight: '700', color: colors.brand },
})

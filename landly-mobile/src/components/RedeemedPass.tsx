import { StyleSheet, View } from 'react-native'
import type { VoucherDocument } from '@shared/firebase/vouchers'
import { formatRedeemedDate } from '@shared/format'
import { REDEMPTION_METHOD_LABEL_KEYS } from '@shared/offers/redemption'
import { localizeText } from '@shared/i18n/contentTranslation'
import { localizedBusinessName } from '@shared/business/businessText'
import AppText from './AppText'
import ContentText from './ContentText'
import Emoji from './Emoji'
import VoucherThumb from './VoucherThumb'
import { useLang } from '../i18n/LangProvider'
import { PASS_GLYPHS } from '../lib/categoryGlyphs'
import { colors, radius } from '../theme'

// One redeemed voucher in My Pass → Redeemed: no QR (it can't be used again),
// just what it was -- with the offer's thumbnail, faded, and a check on its
// corner -- and when the business redeemed it (web:
// components/member/RedeemedTab.tsx).
export default function RedeemedPass({ voucher }: { voucher: VoucherDocument & { id: string } }) {
  const { t, lang } = useLang()
  const title = localizeText(voucher.offerTitle, voucher.translations, lang, 'title')
  const name = localizedBusinessName(voucher, lang)
  return (
    <View style={styles.card}>
      <View>
        <VoucherThumb voucher={voucher} muted />
        <View style={styles.check}>
          <Emoji glyph={PASS_GLYPHS.redeemedMark} size={14} />
        </View>
      </View>
      <View style={styles.text}>
        <AppText style={styles.business} numberOfLines={1}>
          {name.text}
        </AppText>
        <ContentText contentLang={title.lang} style={styles.title} numberOfLines={2}>
          {title.text}
        </ContentText>
        <View style={styles.metaRow}>
          <View style={styles.methodChip}>
            <AppText style={styles.methodText}>{t(REDEMPTION_METHOD_LABEL_KEYS[voucher.redemptionMethod])}</AppText>
          </View>
          {voucher.redeemedAt && (
            <AppText style={styles.date}>{t('mobile_redeemed_on').replace('{date}', formatRedeemedDate(voucher.redeemedAt, lang))}</AppText>
          )}
        </View>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    padding: 16,
    marginBottom: 12,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.borderLight,
    backgroundColor: colors.white,
  },
  check: {
    position: 'absolute',
    bottom: -6,
    end: -6,
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.white,
    backgroundColor: colors.successBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: { flex: 1, minWidth: 0 },
  business: { fontSize: 16, lineHeight: 22, fontWeight: '700', color: colors.text },
  title: { fontSize: 14, lineHeight: 20, color: colors.textMuted, marginTop: 2 },
  metaRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', columnGap: 10, rowGap: 6, marginTop: 6 },
  methodChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: colors.borderLight,
    borderRadius: radius.pill,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  methodText: { fontSize: 12, fontWeight: '600', color: colors.textMuted },
  date: { fontSize: 13, color: colors.textMuted },
})

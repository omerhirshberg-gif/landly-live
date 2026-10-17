import { StyleSheet, View } from 'react-native'
import type { VoucherDocument } from '@shared/firebase/vouchers'
import { formatRedeemedDate } from '@shared/format'
import AppText from './AppText'
import LineIcon from './LineIcon'
import { useLang } from '../i18n/LangProvider'
import { colors, radius } from '../theme'

// One redeemed voucher in My Pass → Redeemed: no QR (it can't be used again),
// just what it was and when the business redeemed it (web:
// components/member/RedeemedTab.tsx).
export default function RedeemedPass({ voucher }: { voucher: VoucherDocument & { id: string } }) {
  const { t, lang } = useLang()
  return (
    <View style={styles.card}>
      <View style={styles.check}>
        <LineIcon name="check" size={16} color={colors.success} strokeWidth={2.5} />
      </View>
      <View style={styles.text}>
        <AppText style={styles.business} numberOfLines={1}>
          {voucher.businessName}
        </AppText>
        <AppText style={styles.title} numberOfLines={2}>
          {voucher.offerTitle}
        </AppText>
        {voucher.redeemedAt && (
          <AppText style={styles.date}>{t('mobile_redeemed_on').replace('{date}', formatRedeemedDate(voucher.redeemedAt, lang))}</AppText>
        )}
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
  check: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.successBg, alignItems: 'center', justifyContent: 'center' },
  text: { flex: 1, minWidth: 0, gap: 2 },
  business: { fontSize: 12, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', color: colors.brand },
  title: { fontSize: 15, lineHeight: 20, fontWeight: '700', color: colors.textStrong },
  date: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
})

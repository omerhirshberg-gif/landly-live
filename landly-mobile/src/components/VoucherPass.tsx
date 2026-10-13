import { StyleSheet, View } from 'react-native'
import type { VoucherDocument } from '@shared/firebase/vouchers'
import { useLang } from '../i18n/LangProvider'
import AppText from './AppText'
import VoucherQRCode from './VoucherQRCode'
import { colors, radius } from '../theme'

// One active voucher as a scannable pass — same content as the web member
// area's PerksTab card (components/member/PerksTab.tsx).
export default function VoucherPass({ voucher }: { voucher: VoucherDocument & { id: string } }) {
  const { t } = useLang()
  return (
    <View style={styles.card}>
      <AppText style={styles.business}>{voucher.businessName}</AppText>
      <AppText style={styles.title}>{voucher.offerTitle}</AppText>
      <View style={styles.divider} />
      <View style={styles.qr}>
        <VoucherQRCode voucherId={voucher.id} />
      </View>
      <AppText style={styles.codeLabel}>{t('voucher_redemption_code_label')}</AppText>
      <AppText ltr style={styles.code} selectable>{voucher.redemptionCode}</AppText>
      <AppText style={styles.hint}>{t('voucher_qr_label')}</AppText>
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.borderLight,
    padding: 20,
    marginBottom: 16,
  },
  business: { fontSize: 12, fontWeight: '700', color: colors.brand, letterSpacing: 1, marginBottom: 4 },
  title: { fontSize: 17, fontWeight: '700', color: colors.textStrong },
  divider: { height: 1, backgroundColor: colors.borderLight, marginVertical: 16 },
  qr: { alignItems: 'center', marginBottom: 16 },
  codeLabel: { fontSize: 12, color: colors.textMuted, textAlign: 'center', marginBottom: 4 },
  code: { fontSize: 26, fontWeight: '900', color: colors.textStrong, letterSpacing: 4, textAlign: 'center' },
  hint: { fontSize: 12, color: colors.textFaint, textAlign: 'center', marginTop: 8 },
})

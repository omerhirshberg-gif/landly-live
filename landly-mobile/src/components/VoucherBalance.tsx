import { StyleSheet } from 'react-native'
import { balanceAmount, resolveVoucherRedemptionProgress, type RedemptionProgressInput } from '@shared/vouchers/redemptionProgress'
import AppText from './AppText'
import { useLang } from '../i18n/LangProvider'
import { colors } from '../theme'

// What is left on the voucher, in one line: "Available balance: ₪70". The amount follows the voucher's own state (₪0 once
// redeemed), the sum is never the member's to do, and nothing else is drawn with it. The amount is left-to-right text with
// tabular figures, so it never reverses in Hebrew; a free perk has no balance, so nothing is drawn.
// `card` is the My Pass card's line; `detail` is the voucher screen's centred, larger one. Web: components/member/VoucherBalance.tsx.
export default function VoucherBalance({ voucher, variant = 'card' }: { voucher: RedemptionProgressInput; variant?: 'card' | 'detail' }) {
  const { t } = useLang()
  const progress = resolveVoucherRedemptionProgress(voucher)
  if (!progress) return null
  const [before, after] = t('voucher_balance_available').split('{amount}')
  const amount = balanceAmount(progress)
  const detail = variant === 'detail'
  return (
    <AppText accessibilityLabel={t('voucher_balance_available').replace('{amount}', amount)} style={detail ? styles.detail : styles.card}>
      {before}
      <AppText ltr style={detail ? styles.detail : styles.card}>{amount}</AppText>
      {after}
    </AppText>
  )
}

const styles = StyleSheet.create({
  card: { fontSize: 15, lineHeight: 20, fontWeight: '800', color: colors.heading, fontVariant: ['tabular-nums'] },
  detail: { fontSize: 22, lineHeight: 28, fontWeight: '800', letterSpacing: -0.3, color: colors.heading, textAlign: 'center', fontVariant: ['tabular-nums'] },
})

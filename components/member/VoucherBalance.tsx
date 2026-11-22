'use client'

import { useLang } from '@/lib/i18n/useLang'
import { balanceAmount, resolveVoucherRedemptionProgress, type RedemptionProgressInput } from '@/lib/vouchers/redemptionProgress'

// What is left on the voucher, in one line: "Available balance: ₪70". The amount follows the voucher's own state (₪0 once
// redeemed), the sum is never the member's to do, and nothing else is drawn with it. The amount is isolated left to right with
// tabular figures so it never reverses in Hebrew; a free perk has no balance, so nothing is drawn.
// `card` is the My Pass card's line; `detail` is the voucher page's centred, larger one. Expo: landly-mobile/src/components/VoucherBalance.tsx.
export default function VoucherBalance({ voucher, variant = 'card', className = '' }: { voucher: RedemptionProgressInput; variant?: 'card' | 'detail'; className?: string }) {
  const { t } = useLang()
  const progress = resolveVoucherRedemptionProgress(voucher)
  if (!progress) return null
  const [before, after] = t('voucher_balance_available').split('{amount}')
  const amount = <bdi dir="ltr" className="tabular-nums">{balanceAmount(progress)}</bdi>
  if (variant === 'card') {
    return <p className={`text-start text-[15px] font-extrabold leading-5 text-ink ${className}`}>{before}{amount}{after}</p>
  }
  return <p className={`text-center text-[22px] font-extrabold leading-7 tracking-tight text-ink ${className}`}>{before}{amount}{after}</p>
}

'use client'

import { useLang } from '@/lib/i18n/useLang'
import { formatRedeemedDate } from '@/lib/format'
import type { VoucherDocument } from '@/lib/firebase/vouchers'

type RedeemedVoucher = VoucherDocument & { id: string }

// Redeemed on /member: what each used voucher was and when the business
// redeemed it. No QR, since it can't be used again (app: components/
// RedeemedPass.tsx). The page owns the live list; null while it loads.
export default function RedeemedTab({ vouchers }: { vouchers: RedeemedVoucher[] | null }) {
  const { t, lang } = useLang()

  if (vouchers === null) {
    return <div className="dash-empty-state" />
  }

  if (vouchers.length === 0) {
    return (
      <div className="dash-empty-state">
        <i className="fa-solid fa-receipt"></i>
        <div className="font-bold text-slate-700 text-base mb-1">{t('dash_redeemed_empty_title')}</div>
        <p className="text-sm text-slate-500 max-w-xs">{t('dash_redeemed_empty_sub')}</p>
      </div>
    )
  }

  return (
    <ul className="space-y-3">
      {vouchers.map((voucher) => (
        <li key={voucher.id} className="flex items-start gap-3 rounded-2xl border border-slate-100 bg-white p-4">
          <span aria-hidden="true" className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-green-50 text-green-700">
            <i className="fa-solid fa-check text-sm"></i>
          </span>
          <div className="min-w-0 flex-1">
            <div className="truncate text-xs font-bold uppercase tracking-widest text-brand">{voucher.businessName}</div>
            <div className="mt-0.5 line-clamp-2 break-words font-bold text-slate-900">{voucher.offerTitle}</div>
            {voucher.redeemedAt && (
              <div className="mt-1 text-[13px] text-slate-500">
                {t('mobile_redeemed_on').replace('{date}', formatRedeemedDate(voucher.redeemedAt, lang))}
              </div>
            )}
          </div>
        </li>
      ))}
    </ul>
  )
}

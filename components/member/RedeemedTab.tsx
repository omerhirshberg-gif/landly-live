'use client'

import { useLang } from '@/lib/i18n/useLang'
import { localizeText } from '@/lib/i18n/contentTranslation'
import { localizedBusinessName } from '@/lib/business/businessText'
import { formatRedeemedDate } from '@/lib/format'
import type { VoucherDocument } from '@/lib/firebase/vouchers'
import RedemptionBadge from '@/components/discover/RedemptionBadge'
import VoucherThumb from './VoucherThumb'

type RedeemedVoucher = VoucherDocument & { id: string }

// Redeemed on /member: what each used voucher was -- with the offer's
// thumbnail, muted -- and when the business redeemed it. No QR, since it can't be used again (app: components/
// RedeemedPass.tsx). The page owns the live list; null while it loads.
export default function RedeemedTab({ vouchers }: { vouchers: RedeemedVoucher[] | null }) {
  const { t, lang } = useLang()

  if (vouchers === null) {
    return <div className="dash-empty-state" />
  }

  if (vouchers.length === 0) {
    return (
      <div className="dash-empty-state">
        <i className="fa-solid fa-receipt" aria-hidden="true"></i>
        <div className="font-bold text-slate-700 text-base mb-1">{t('dash_redeemed_empty_title')}</div>
        <p className="text-sm text-slate-500 max-w-xs">{t('dash_redeemed_empty_sub')}</p>
      </div>
    )
  }

  return (
    <ul className="mx-auto max-w-xl space-y-3">
      {vouchers.map((voucher) => (
        <li key={voucher.id} className="flex items-start gap-3 rounded-2xl border border-slate-100 bg-white p-4 sm:gap-4">
          {/* Muted, with a check on its corner: this one's been used. */}
          <div className="relative flex-shrink-0">
            <VoucherThumb voucher={voucher} muted />
            <span aria-hidden="true" className="absolute -bottom-1.5 -end-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-green-50 text-green-700 ring-2 ring-white">
              <i className="fa-solid fa-check text-[11px]" aria-hidden="true"></i>
            </span>
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-base font-bold leading-snug text-slate-700" dir="auto">{localizedBusinessName(voucher, lang).text}</div>
            <div className="mt-0.5 line-clamp-2 break-words text-sm leading-snug text-slate-500" dir="auto">{localizeText(voucher.offerTitle, voucher.translations, lang, 'title').text}</div>
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5">
              <RedemptionBadge method={voucher.redemptionMethod} />
              {voucher.redeemedAt && (
                <span className="text-[13px] text-slate-500">
                  {t('mobile_redeemed_on').replace('{date}', formatRedeemedDate(voucher.redeemedAt, lang))}
                </span>
              )}
            </div>
          </div>
        </li>
      ))}
    </ul>
  )
}

'use client'

import Link from 'next/link'
import { useLang } from '@/lib/i18n/useLang'
import { formatLongDate } from '@/lib/format'
import type { VoucherDocument } from '@/lib/firebase/vouchers'
import RedemptionBadge from '@/components/discover/RedemptionBadge'
import VoucherThumb from './VoucherThumb'

type ActiveVoucher = VoucherDocument & { id: string }

// My Perks on /member: each active voucher as a compact card with the
// offer's thumbnail on the start side. Tapping it opens the voucher's own
// page (app/member/vouchers/[voucherId]), where the QR code and the numeric
// code each stay hidden until tapped. The page owns the live list
// (shared with the stats row); null while it loads.
export default function PerksTab({ vouchers }: { vouchers: ActiveVoucher[] | null }) {
  const { t } = useLang()

  if (vouchers === null) {
    return (
      <div role="status" className="dash-empty-state">
        <span className="sr-only">{t('bizdash_loading')}</span>
      </div>
    )
  }

  if (vouchers.length === 0) {
    return (
      <div>
        <div className="dash-empty-state">
          <i className="fa-solid fa-gift" aria-hidden="true"></i>
          <div className="font-bold text-slate-700 text-base mb-1">{t('dash_perks_empty_title')}</div>
          <p className="text-sm text-slate-500 max-w-xs mb-5">{t('dash_perks_empty_sub')}</p>
          <Link href="/categories" className="tap-target btn-primary">
            <span>{t('nav_cta')}</span>
          </Link>
        </div>
      </div>
    )
  }

  return (
    <ul className="mx-auto max-w-xl space-y-3">
      {vouchers.map((voucher) => (
        <li key={voucher.id}>
          <VoucherCard voucher={voucher} />
        </li>
      ))}
    </ul>
  )
}

// The whole card is the link to the voucher page; the pill at its foot only
// says what tapping does. It lifts on hover only on devices that really hover,
// and presses in slightly on touch.
function VoucherCard({ voucher }: { voucher: ActiveVoucher }) {
  const { t, lang } = useLang()
  const expired = !!voucher.expiresAt && voucher.expiresAt.getTime() < Date.now()

  return (
    <Link
      href={`/member/vouchers/${encodeURIComponent(voucher.id)}`}
      className="group block rounded-2xl border border-slate-100 bg-white p-4 shadow-sm transition-[box-shadow,transform,border-color] duration-200 active:scale-[0.98] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0038B8] motion-reduce:transition-none motion-reduce:active:scale-100 sm:p-5 [@media(hover:hover)]:hover:-translate-y-0.5 [@media(hover:hover)]:hover:border-slate-200 [@media(hover:hover)]:hover:shadow-md motion-reduce:[@media(hover:hover)]:hover:translate-y-0"
    >
      <div className="flex items-start gap-3 sm:gap-4">
        <VoucherThumb voucher={voucher} />
        <div className="min-w-0 flex-1">
          <div className="truncate text-base font-bold leading-snug text-[#0B1B3D]" dir="auto">{voucher.businessName}</div>
          <h3 className="mt-0.5 line-clamp-2 text-sm leading-snug text-[#475569]" dir="auto">{voucher.offerTitle}</h3>
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5">
            <RedemptionBadge method={voucher.redemptionMethod} />
            {voucher.expiresAt && (
              <span className={`inline-flex items-center gap-1.5 text-xs font-semibold ${expired ? 'text-red-600' : 'text-slate-500'}`}>
                <i className={`fa-regular ${expired ? 'fa-calendar-xmark' : 'fa-calendar-check'}`} aria-hidden="true"></i>
                <span>{t(expired ? 'voucher_expired_on' : 'voucher_valid_until').replace('{date}', formatLongDate(voucher.expiresAt, lang))}</span>
              </span>
            )}
          </div>
        </div>
      </div>
      <span className="mt-4 flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-brand text-sm font-bold text-white shadow-md transition-colors [@media(hover:hover)]:group-hover:bg-brandDark">
        <i className="fa-solid fa-ticket" aria-hidden="true"></i>
        <span>{t('voucher_show_button')}</span>
        <i className="fa-solid fa-chevron-right text-xs rtl:-scale-x-100" aria-hidden="true"></i>
      </span>
    </Link>
  )
}

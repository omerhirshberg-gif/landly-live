'use client'

import Link from 'next/link'
import { CalendarCheck, CalendarX, ChevronRight, Gift } from 'lucide-react'
import { useLang } from '@/lib/i18n/useLang'
import { localizeText } from '@/lib/i18n/contentTranslation'
import { localizedBusinessName } from '@/lib/business/businessText'
import { formatLongDate } from '@/lib/format'
import type { VoucherDocument } from '@/lib/firebase/vouchers'
import RedemptionBadge from '@/components/discover/RedemptionBadge'
import { VoucherListSkeleton } from '@/components/ui/Skeleton'
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
    return <VoucherListSkeleton />
  }

  if (vouchers.length === 0) {
    return (
      <div>
        <div className="dash-empty-state">
          <Gift aria-hidden="true" strokeWidth={1.75} />
          <div className="font-bold text-ink text-base mb-1">{t('dash_perks_empty_title')}</div>
          <p className="text-sm text-body max-w-xs mb-5">{t('dash_perks_empty_sub')}</p>
          <Link href="/categories" className="ds-btn ds-btn-primary">
            <span>{t('nav_cta')}</span>
          </Link>
        </div>
      </div>
    )
  }

  // One column on phones; two from an unfolded foldable (600px;
  // lib/layout/foldable.ts) up, so neither the inner screen nor the desktop
  // page's main column is a strip of stretched rows beside empty space.
  return (
    <ul className="grid gap-3 fold:grid-cols-2">
      {vouchers.map((voucher) => (
        <li key={voucher.id}>
          <VoucherCard voucher={voucher} />
        </li>
      ))}
    </ul>
  )
}

// The whole card is the link to the voucher page: thumbnail on the start
// side, then business, offer, method and validity, and a chevron on the end
// side (pointing left in Hebrew) that says it opens. No separate button. It
// lifts on hover only on devices that really hover, and presses in slightly
// on touch.
function VoucherCard({ voucher }: { voucher: ActiveVoucher }) {
  const { t, lang } = useLang()
  const expired = !!voucher.expiresAt && voucher.expiresAt.getTime() < Date.now()

  return (
    <Link
      href={`/member/vouchers/${encodeURIComponent(voucher.id)}`}
      className="group flex min-h-12 items-center gap-3 rounded-2xl border border-line bg-white p-4 shadow-card transition-all duration-200 active:scale-[0.98] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand motion-reduce:transition-none motion-reduce:active:scale-100 sm:gap-4 sm:p-5 [@media(hover:hover)]:hover:-translate-y-0.5 [@media(hover:hover)]:hover:border-slate-300 [@media(hover:hover)]:hover:shadow-card-hover motion-reduce:[@media(hover:hover)]:hover:translate-y-0"
    >
      <VoucherThumb voucher={voucher} />
      <div className="min-w-0 flex-1">
        <div className="truncate text-base font-bold leading-snug text-ink" dir="auto">{localizedBusinessName(voucher, lang).text}</div>
        <h3 className="mt-0.5 line-clamp-2 text-sm leading-snug text-body" dir="auto">{localizeText(voucher.offerTitle, voucher.translations, lang, 'title').text}</h3>
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5">
          <RedemptionBadge method={voucher.redemptionMethod} />
          {voucher.expiresAt && (
            <span className={`inline-flex items-center gap-1.5 text-xs font-semibold ${expired ? 'text-red-600' : 'text-slate-500'}`}>
              {expired ? <CalendarX aria-hidden="true" className="h-3.5 w-3.5" strokeWidth={2} /> : <CalendarCheck aria-hidden="true" className="h-3.5 w-3.5" strokeWidth={2} />}
              <span>{t(expired ? 'voucher_expired_on' : 'voucher_valid_until').replace('{date}', formatLongDate(voucher.expiresAt, lang))}</span>
            </span>
          )}
        </div>
      </div>
      {/* Screen readers hear what the card does; sighted members see the chevron. */}
      <span className="sr-only">{t('voucher_show_button')}</span>
      <ChevronRight
        aria-hidden="true"
        className="h-4 w-4 flex-shrink-0 text-muted transition-[color,transform] duration-200 rtl:-scale-x-100 [@media(hover:hover)]:group-hover:translate-x-0.5 [@media(hover:hover)]:group-hover:text-brand rtl:[@media(hover:hover)]:group-hover:-translate-x-0.5 motion-reduce:transition-none"
        strokeWidth={2}
      />
    </Link>
  )
}

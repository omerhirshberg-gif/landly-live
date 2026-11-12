'use client'

import Link from 'next/link'
import { useState } from 'react'
import { ChevronRight, Clock, Gift, MapPin } from 'lucide-react'
import { useLang } from '@/lib/i18n/useLang'
import { localizeText } from '@/lib/i18n/contentTranslation'
import { localizedBusinessName } from '@/lib/business/businessText'
import { formatLongDate } from '@/lib/format'
import type { VoucherDocument } from '@/lib/firebase/vouchers'
import { VoucherListSkeleton } from '@/components/ui/Skeleton'
import { voucherDestination } from '@/lib/member/voucherDestination'
import TicketTear from './TicketTear'
import VoucherCover from './VoucherCover'

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
    <ul className="grid gap-4 fold:grid-cols-2">
      {vouchers.map((voucher) => (
        <li key={voucher.id}>
          <VoucherCard voucher={voucher} />
        </li>
      ))}
    </ul>
  )
}

// The whole card is the link to the voucher page (the app: VoucherPass.tsx): the
// offer's cover with the business's squircle logo across its bottom start
// corner, then the business and the deal and, under a perforated tear-line with
// a bite out of each side edge, when it runs out (amber under a week, red once
// it has) and a "View voucher" pill. It lifts on hover only on devices that
// really hover, and presses in slightly on touch.
const DAY_MS = 24 * 60 * 60 * 1000

function VoucherCard({ voucher }: { voucher: ActiveVoucher }) {
  const { t, lang } = useLang()
  // Read once per mount, since render must stay pure.
  const [now] = useState(Date.now)
  const expired = !!voucher.expiresAt && voucher.expiresAt.getTime() < now
  const soon = !!voucher.expiresAt && !expired && voucher.expiresAt.getTime() - now < 7 * DAY_MS
  const name = localizedBusinessName(voucher, lang).text
  const { place } = voucherDestination(voucher, lang)

  return (
    <Link
      href={`/member/vouchers/${encodeURIComponent(voucher.id)}`}
      className="group block rounded-2xl border border-slate-100 bg-white shadow-[0_8px_30px_rgb(0,0,0,0.05)] transition-all duration-300 active:scale-[0.98] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand motion-reduce:transition-none motion-reduce:active:scale-100 [@media(hover:hover)]:hover:-translate-y-1 [@media(hover:hover)]:hover:border-slate-200 [@media(hover:hover)]:hover:shadow-card-hover motion-reduce:[@media(hover:hover)]:hover:translate-y-0"
    >
      <VoucherCover voucher={voucher} name={name} />
      <div className="px-3.5 pb-3 pt-6">
        <div className="truncate text-[17px] font-extrabold leading-snug text-ink" dir="auto">{name}</div>
        <h3 className="mt-0.5 line-clamp-2 text-sm leading-snug text-body" dir="auto">{localizeText(voucher.offerTitle, voucher.translations, lang, 'title').text}</h3>
        {place && (
          <p className="mt-2 flex items-center gap-1.5 text-xs text-muted">
            <MapPin aria-hidden="true" className="h-3.5 w-3.5 shrink-0" strokeWidth={1.75} />
            <span className="truncate" dir="auto">{place}</span>
          </p>
        )}
      </div>
      <TicketTear />
      <div className="flex items-center justify-between gap-2.5 px-3.5 pb-3.5 pt-2.5">
        <span className={`inline-flex min-w-0 items-center gap-1.5 text-xs font-semibold ${expired ? 'text-red-600' : soon ? 'text-amber-600' : 'text-slate-500'}`}>
          {voucher.expiresAt && (
            <>
              <Clock aria-hidden="true" className="h-3.5 w-3.5 shrink-0" strokeWidth={1.75} />
              <span className="truncate">{t(expired ? 'voucher_expired_on' : 'voucher_valid_until').replace('{date}', formatLongDate(voucher.expiresAt, lang))}</span>
            </>
          )}
        </span>
        <span className="inline-flex min-h-8 shrink-0 items-center gap-0.5 rounded-full border border-slate-200/70 bg-brandTint py-1 ps-3 pe-2 text-[13px] font-bold text-brand">
          {t('voucher_show_button')}
          <ChevronRight aria-hidden="true" className="h-4 w-4 transition-transform duration-200 rtl:-scale-x-100 [@media(hover:hover)]:group-hover:translate-x-0.5 rtl:[@media(hover:hover)]:group-hover:-translate-x-0.5 motion-reduce:transition-none" strokeWidth={2.2} />
        </span>
      </div>
    </Link>
  )
}

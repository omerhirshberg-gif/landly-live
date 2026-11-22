'use client'

import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import type { OfferDocument } from '@/lib/firebase/offers'
import { ARCH, ARROW, EMBLEM_VIEWBOX, STAR } from '@/lib/brand/emblemPaths'
import { useRaayonitDisplay } from '@/lib/flags/raayonitDisplayStore'
import { bannerFigures, isolateLtr } from '@/lib/home/superShowcase'
import { useLang } from '@/lib/i18n/useLang'
import { RAAYONIT_HUB } from '@/lib/offers/offerRoutes'
import { RAAYONIT_LOGO_PATH } from '@/lib/payments/issuer'

// The slim Raayonit Card entry banner on top of Home (native: landly-mobile/src/components/RaayonitPromoStrip.tsx): a mini club-card
// thumbnail, the product name with a one-line "up to {percent}% off at {count}+ chains" note (both read live: the flagship's best discount and the chain count, 14 and 230 until known), and a link to
// the Raayonit Card tab, where the purchase lives. The partner's badge follows the display flag.
export default function RaayonitPromoStrip({ offer, count }: { offer: OfferDocument | null; count: number }) {
  const { t } = useLang()
  const display = useRaayonitDisplay()
  const figures = bannerFigures(offer, count)
  const sub = t('raayonit_banner_sub').replace('{percent}', isolateLtr(`${figures.percent}%`)).replace('{count}', isolateLtr(`${figures.count}+`))
  const cta = t('raayonit_banner_cta')
  return (
    <Link
      href={RAAYONIT_HUB}
      aria-label={`${t('products_card_name')}. ${sub}. ${cta}`}
      className="group mx-auto flex min-h-[76px] w-full max-w-6xl items-center gap-3 rounded-2xl border border-blue-100 bg-gradient-to-br from-blue-50/70 to-indigo-50/30 px-3 py-2.5 shadow-[0_8px_30px_rgb(0,0,0,0.04)] transition-all duration-300 hover:-translate-y-0.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand sm:gap-4 sm:px-4 sm:py-3"
    >
      <span aria-hidden="true" dir="ltr" className="flex h-11 w-16 shrink-0 items-center justify-center gap-1 rounded-[9px] bg-gradient-to-br from-blue-700 to-[#0B2A8F] sm:h-12 sm:w-[72px]">
        <svg viewBox={`0 0 ${EMBLEM_VIEWBOX.width} ${EMBLEM_VIEWBOX.height}`} className="h-[18px] w-auto" focusable="false">
          {[STAR, ARCH, ARROW].map((part, i) => (
            <g key={i}>
              <path d={part.light} fill="#fff" fillRule="evenodd" />
              <path d={part.dark} fill="rgba(255,255,255,0.72)" fillRule="evenodd" />
            </g>
          ))}
        </svg>
        {display && (
          <span className="flex h-[22px] items-center rounded-[5px] bg-white px-[3px]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={RAAYONIT_LOGO_PATH} alt="" width={12} height={18} className="h-[18px] w-auto" />
          </span>
        )}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-start text-[15px] font-extrabold leading-5 tracking-tight text-ink"><bdi>{t('products_card_name')}</bdi></span>
        <span className="mt-0.5 block text-[13px] leading-[18px] text-muted">{sub}</span>
      </span>
      <span className="flex shrink-0 items-center gap-0.5 text-sm font-bold text-brand">
        <span className="hidden sm:inline">{cta}</span>
        <ChevronRight aria-hidden="true" className="h-[18px] w-[18px] transition-transform duration-300 rtl:-scale-x-100 [@media(hover:hover)]:group-hover:translate-x-0.5 rtl:[@media(hover:hover)]:group-hover:-translate-x-0.5" strokeWidth={2} />
      </span>
    </Link>
  )
}

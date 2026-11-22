'use client'

import BrandMedia from '@/components/ui/BrandMedia'
import { useState } from 'react'
import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import type { OfferDocument } from '@/lib/firebase/offers'
import { localizedBusinessName } from '@/lib/business/businessText'
import { useLang } from '@/lib/i18n/useLang'
import { raayonitCategoryName } from '@/lib/offers/raayonitCategories'
import { redemptionBadge, REDEMPTION_BADGE_KEYS } from '@/lib/offers/raayonitRegions'
import { webOfferPath } from '@/lib/offers/offerRoutes'
import { RAAYONIT_LOGO_PATH } from '@/lib/payments/issuer'

// A venue as a framed white card: the picture edge to edge on top, then the name, "Category · coverage" and a quiet redemption line with "Details".
export default function ChainTile({ offer }: { offer: OfferDocument }) {
  const { t, lang } = useLang()
  const [failed, setFailed] = useState(false)
  const label = localizedBusinessName(offer, lang).text
  const src = failed || !offer.imageUrl ? RAAYONIT_LOGO_PATH : offer.imageUrl
  const count = offer.branches?.length ?? 0
  const cover = !failed && !!offer.imageUrl && offer.logoKind === 'photo'
  return (
    <Link href={webOfferPath(offer.id)} className="group flex h-full flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_2px_8px_rgba(15,23,42,0.05)] transition-all duration-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand [@media(hover:hover)]:hover:-translate-y-0.5 [@media(hover:hover)]:hover:shadow-card-hover">
      <span className="relative block aspect-[16/10] w-full overflow-hidden bg-[#EEF2F7]">
        <BrandMedia src={src} cover={cover} onError={() => setFailed(true)} />
      </span>
      <span className="flex flex-1 flex-col gap-0.5 p-3">
        <bdi dir="auto" className="block truncate text-[15px] font-semibold text-ink">{label}</bdi>
        <span className="block truncate text-xs text-slate-500">
          <bdi dir="auto">{[offer.raayonitCategory ? raayonitCategoryName(offer.raayonitCategory, lang) : null, count === 0 ? t('raayonit_nationwide') : count === 1 ? t('brands_one_branch') : t('raayonit_branch_count').replace('{count}', String(count))].filter(Boolean).join(' · ')}</bdi>
        </span>
        <span className="mt-2 flex items-center justify-between gap-2 text-xs">
          <span className="min-w-0 flex-1 truncate text-slate-600">{t(REDEMPTION_BADGE_KEYS[redemptionBadge(offer)])}</span>
          <span className="flex shrink-0 items-center gap-0.5 font-bold text-brand">
            {t('raayonit_details_link')}
            <ChevronRight aria-hidden="true" className="h-3.5 w-3.5 rtl:-scale-x-100" strokeWidth={2} />
          </span>
        </span>
      </span>
    </Link>
  )
}

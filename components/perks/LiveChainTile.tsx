'use client'

import BrandMedia from '@/components/ui/BrandMedia'
import { useState } from 'react'
import Link from 'next/link'
import { CircleCheck } from 'lucide-react'
import type { OfferDocument } from '@/lib/firebase/offers'
import { localizedBusinessName } from '@/lib/business/businessText'
import { useLang } from '@/lib/i18n/useLang'
import { webOfferPath } from '@/lib/offers/offerRoutes'
import { RAAYONIT_LOGO_PATH } from '@/lib/payments/issuer'

// A participating chain on Home and Explore Perks (native: landly-mobile/src/components/LiveChainTile.tsx): the logo or photo, the name and one
// quiet line, a check and "Redeemable now". Smaller than the Raayonit tab's directory card (no category, branch count or details link): it says "this works today".
export default function LiveChainTile({ offer }: { offer: OfferDocument }) {
  const { t, lang } = useLang()
  const [failed, setFailed] = useState(false)
  const label = localizedBusinessName(offer, lang).text
  const src = failed || !offer.imageUrl ? RAAYONIT_LOGO_PATH : offer.imageUrl
  const cover = !failed && !!offer.imageUrl && offer.logoKind === 'photo'
  return (
    <Link href={webOfferPath(offer.id)} className="group flex h-full w-full flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_2px_8px_rgba(15,23,42,0.05)] transition-all duration-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand [@media(hover:hover)]:hover:-translate-y-0.5 [@media(hover:hover)]:hover:shadow-card-hover motion-reduce:transition-none motion-reduce:[@media(hover:hover)]:hover:translate-y-0">
      <span className="relative block aspect-[4/3] w-full overflow-hidden bg-[#EEF2F7]">
        <BrandMedia src={src} cover={cover} onError={() => setFailed(true)} />
      </span>
      <span className="flex flex-col gap-1 px-3 py-2.5">
        <bdi dir="auto" className="block truncate text-sm font-semibold text-ink">{label}</bdi>
        <span className="flex items-center gap-1.5 text-xs font-semibold text-green-700">
          <CircleCheck aria-hidden="true" className="h-3.5 w-3.5 shrink-0" strokeWidth={1.75} />
          <span className="truncate">{t('chains_live_badge')}</span>
        </span>
      </span>
    </Link>
  )
}

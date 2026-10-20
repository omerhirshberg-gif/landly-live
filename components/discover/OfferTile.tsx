'use client'

import Link from 'next/link'
import { getOfferDiscountPercent, type OfferDocument } from '@/lib/firebase/offers'
import { formatPrice } from '@/lib/format'
import { localizeText } from '@/lib/i18n/contentTranslation'
import { localizedBusinessName } from '@/lib/business/businessText'
import { useLang } from '@/lib/i18n/useLang'
import DiscountBadge from './DiscountBadge'
import PerkImage from './PerkImage'

// The Perks tab's highlight rails (OfferTileRail): a short, sideways perk
// card, 140px tall, so the New and Best Sellers rails both fit a phone above
// the category grid. A 104px photo strip on the leading side carries the discount pill;
// the trailing side has the business, the offer (two lines at most) and the
// price at the bottom. The whole card is the link. Width comes from the
// rail's grid column. Hebrew mirrors it through the page's dir. Same anatomy
// as the Expo app's components/OfferTile.tsx.
export default function OfferTile({ offer }: { offer: OfferDocument }) {
  const { lang } = useLang()
  const title = localizeText(offer.title, offer.translations, lang, 'title')
  const name = localizedBusinessName(offer, lang)
  const discount = getOfferDiscountPercent(offer.originalPrice, offer.offerPrice)
  return (
    <Link
      href={`/offers/${offer.id}`}
      className="group flex h-[140px] w-full snap-start overflow-hidden rounded-2xl border border-[#E2E8F0] bg-white shadow-sm transition-[box-shadow,border-color] duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0038B8] motion-reduce:transition-none [@media(hover:hover)]:hover:border-[#CBD5E1] [@media(hover:hover)]:hover:shadow-md active:bg-slate-50"
    >
      <div className="relative h-full w-[104px] flex-shrink-0 overflow-hidden bg-[#F0F7FF]">
        <PerkImage src={offer.imageUrl} alt={title.text} category={offer.category} businessName={name.text} />
        <DiscountBadge percent={discount} size="sm" className="absolute bottom-2 start-2" />
      </div>
      <div className="flex min-w-0 flex-1 flex-col p-3">
        <div className="truncate text-sm font-bold leading-snug text-[#0B1B3D]" lang={name.lang ?? undefined} dir="auto">
          {name.text}
        </div>
        <p className="mt-0.5 line-clamp-2 text-[13px] leading-snug text-[#475569]" lang={title.lang ?? undefined} dir="auto">
          {title.text}
        </p>
        <div className="mt-auto flex min-w-0 flex-wrap items-baseline gap-x-2 rtl:justify-end" dir="ltr">
          <span className="text-base font-extrabold tracking-tight text-[#0038B8]">{formatPrice(offer.offerPrice)}</span>
          {discount > 0 && (
            <span className="text-xs text-[#94A3B8] line-through decoration-[#94A3B8]/70">{formatPrice(offer.originalPrice)}</span>
          )}
        </div>
      </div>
    </Link>
  )
}

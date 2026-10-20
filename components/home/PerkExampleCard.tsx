'use client'

import Link from 'next/link'
import PerkImage from '@/components/discover/PerkImage'
import { CATEGORY_TILES } from '@/lib/categories'
import { getOfferDiscountPercent, type OfferDocument } from '@/lib/firebase/offers'
import { formatPrice } from '@/lib/format'
import { useLang } from '@/lib/i18n/useLang'
import { localizeText } from '@/lib/i18n/contentTranslation'
import { localizedBusinessName } from '@/lib/business/businessText'

// A perk in the guest home's "Real examples" showcase: lighter than the
// feeds' OfferCard -- the category pill (icon and name) on a 130px photo,
// the business and the perk, and a price pill (club price, struck-through
// original). The whole card links to the offer, which guests can read in full;
// its purchase bar is where they're asked to sign in.
export default function PerkExampleCard({ offer }: { offer: OfferDocument }) {
  const { t, lang } = useLang()
  const title = localizeText(offer.title, offer.translations, lang, 'title')
  const name = localizedBusinessName(offer, lang)
  const tile = CATEGORY_TILES.find((c) => c.category === offer.category)
  const discounted = getOfferDiscountPercent(offer.originalPrice, offer.offerPrice) > 0

  return (
    <Link
      href={`/offers/${encodeURIComponent(offer.id)}`}
      className="group flex w-full flex-col overflow-hidden rounded-2xl border border-[#E2E8F0] bg-white/95 backdrop-blur-sm shadow-sm transition-[box-shadow,transform,border-color] duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0038B8] motion-reduce:transition-none [@media(hover:hover)]:hover:-translate-y-0.5 [@media(hover:hover)]:hover:border-[#CBD5E1] [@media(hover:hover)]:hover:shadow-md motion-reduce:[@media(hover:hover)]:hover:translate-y-0"
    >
      <div className="relative h-[130px] overflow-hidden bg-[#F0F7FF]">
        <PerkImage src={offer.imageUrl} alt={title.text} category={offer.category} businessName={name.text} />
        {tile && (
          <span className="absolute top-2.5 start-2.5 inline-flex max-w-[75%] items-center gap-1 rounded-full bg-white/95 px-2.5 py-1 text-[11px] font-semibold text-[#0B1B3D] shadow-sm">
            <span className="truncate">{t(tile.labelKey)}</span>
            <i className={`fa-solid ${tile.icon} text-[10px] text-brand`} aria-hidden="true"></i>
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col p-3.5">
        <div className="truncate text-[15px] font-bold leading-snug text-[#0B1B3D]" lang={name.lang ?? undefined} dir="auto">{name.text}</div>
        {/* Two lines reserved, so neighbouring cards' price pills line up. */}
        <p className="mt-0.5 line-clamp-2 min-h-[2.5em] text-[13px] leading-snug text-[#475569]" lang={title.lang ?? undefined} dir="auto">{title.text}</p>
        <div className="mt-auto pt-3">
          <span className="inline-flex items-baseline gap-2 rounded-full bg-[#F0F7FF] px-3 py-1" dir="ltr">
            <span className="text-base font-extrabold tracking-tight text-[#0038B8]">{formatPrice(offer.offerPrice)}</span>
            {discounted && <span className="text-xs text-[#94A3B8] line-through decoration-[#94A3B8]/70">{formatPrice(offer.originalPrice)}</span>}
          </span>
        </div>
      </div>
    </Link>
  )
}

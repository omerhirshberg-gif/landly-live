'use client'

import Link from 'next/link'
import PerkImage from '@/components/discover/PerkImage'
import CategoryIcon from '@/components/ui/CategoryIcon'
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
      className="group flex w-full flex-col overflow-hidden rounded-2xl border border-line bg-white/95 backdrop-blur-sm shadow-card transition-[box-shadow,transform,border-color] duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand motion-reduce:transition-none [@media(hover:hover)]:hover:-translate-y-0.5 [@media(hover:hover)]:hover:border-slate-300 [@media(hover:hover)]:hover:shadow-card-hover motion-reduce:[@media(hover:hover)]:hover:translate-y-0"
    >
      <div className="relative h-[130px] overflow-hidden bg-brandTint">
        <PerkImage src={offer.imageUrl} alt={title.text} category={offer.category} businessName={name.text} />
        {tile && (
          <span className="absolute top-2.5 start-2.5 inline-flex max-w-[75%] items-center gap-1 rounded-full bg-white/95 px-2.5 py-1 text-micro font-semibold text-ink shadow-sm">
            <span className="truncate">{t(tile.labelKey)}</span>
            <CategoryIcon category={tile.category} className="h-3 w-3 flex-shrink-0 text-brand" strokeWidth={2} />
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col p-3.5">
        <div className="truncate text-copy font-bold leading-snug text-ink" lang={name.lang ?? undefined} dir="auto">{name.text}</div>
        {/* Two lines reserved, so neighbouring cards' price pills line up. */}
        <p className="mt-0.5 line-clamp-2 min-h-[2.5em] text-meta leading-snug text-body" lang={title.lang ?? undefined} dir="auto">{title.text}</p>
        <div className="mt-auto pt-3">
          <span className="inline-flex items-baseline gap-2 rounded-full bg-brandTint px-3 py-1" dir="ltr">
            <span className="text-base font-extrabold tracking-tight text-brand">{formatPrice(offer.offerPrice)}</span>
            {discounted && <span className="text-xs text-muted line-through decoration-muted/70">{formatPrice(offer.originalPrice)}</span>}
          </span>
        </div>
      </div>
    </Link>
  )
}

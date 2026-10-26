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
// the category grid. A framed picture on the leading side (light canvas,
// hairline border, 14px corners, inset from the card's edges); the trailing
// side has the business, the offer (two lines at most) and the price, the
// struck-through original and the discount pill at the bottom. The whole card is the link. Width comes from the
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
      className="group flex h-[140px] w-full snap-start overflow-hidden rounded-2xl border border-line bg-white shadow-card transition-[box-shadow,border-color,transform] duration-200 ease-out-expo focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand motion-reduce:transition-none [@media(hover:hover)]:hover:border-slate-300 [@media(hover:hover)]:hover:shadow-card-hover active:scale-[0.98] active:bg-slate-50"
    >
      <div className="relative my-2 ms-2 w-24 flex-shrink-0 overflow-hidden rounded-[14px] border border-line bg-canvas">
        <PerkImage src={offer.imageUrl} alt={title.text} category={offer.category} businessName={name.text} />
      </div>
      <div className="flex min-w-0 flex-1 flex-col p-3">
        <div className="truncate text-sm font-bold leading-snug text-ink" lang={name.lang ?? undefined} dir="auto">
          {name.text}
        </div>
        <p className="mt-0.5 line-clamp-2 text-meta leading-snug text-body" lang={title.lang ?? undefined} dir="auto">
          {title.text}
        </p>
        {/* The badge sits in the price row, never over the picture, outside the
            prices' left-to-right run so "15% הנחה" still reads in Hebrew order. */}
        <div className="mt-auto flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-1">
          <div className="flex min-w-0 flex-wrap items-baseline gap-x-2" dir="ltr">
            <span className="text-base font-extrabold tracking-tight text-brand">{formatPrice(offer.offerPrice)}</span>
            {discount > 0 && (
              <span className="text-xs text-muted line-through decoration-muted/70">{formatPrice(offer.originalPrice)}</span>
            )}
          </div>
          <DiscountBadge percent={discount} size="sm" />
        </div>
      </div>
    </Link>
  )
}

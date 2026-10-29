'use client'

import Link from 'next/link'
import { ArrowRight, Heart, MapPin } from 'lucide-react'
import { useLang } from '@/lib/i18n/useLang'
import { useAuth } from '@/lib/firebase/useAuth'
import { useWishlist } from '@/lib/firebase/useWishlist'
import { CATEGORY_TILES } from '@/lib/categories'
import { getOfferDiscountPercent, type OfferDocument } from '@/lib/firebase/offers'
import { formatPrice } from '@/lib/format'
import { localizeText } from '@/lib/i18n/contentTranslation'
import { localizedBusinessName } from '@/lib/business/businessText'
import { formatDistance, offerPlaceLabel } from '@/lib/geo'
import DiscountBadge from './DiscountBadge'
import MerchantBadge from './MerchantBadge'
import PerkImage from './PerkImage'
import RedemptionBadge from './RedemptionBadge'

// The feeds' grid lives on its own (offerFeedGrid.ts), so a loading skeleton
// can share it without loading the card and Firebase with it.
export { OFFER_FEED_GRID } from './offerFeedGrid'

interface OfferCardProps {
  offer: OfferDocument
  showWishlistButton?: boolean
  /**
   * 'rail': a compact, fixed-width card for a horizontal scroller (240-260px,
   * smaller type), so the next card peeks in. 'grid': fills its grid cell.
   */
  layout?: 'rail' | 'grid'
  /** The category pill on the photo. Off in a list already scoped to one category, where every card would repeat it. */
  showCategoryBadge?: boolean
  /** Kilometres from the member's location (Near me), shown before the place; undefined without one. */
  distanceKm?: number | null
}

// A perk: photo (or branded fallback) with its category badge, then the
// business as a small uppercase eyebrow over the offer in bold (two lines at
// most), where and how it's redeemed, and the price. The whole
// card is the link; the footer line only says what tapping does. The lift on
// hover is limited to devices that really hover, so a tap never leaves a
// phone's card stuck raised. Compact, so a phone's feed shows more than one
// perk per screen: a 16:9 picture in its own framed box (light canvas,
// hairline border, 14px corners) inset from the card's edges, so a white logo
// never melts into the white card; tight padding; and the price, the
// struck-through original and the discount badge sharing one row with the
// CTA. Prices sit in <bdi> in the body font, "₪" included, so the symbol and
// digits never mix fonts. Same anatomy as the Expo app's OfferCard.
export default function OfferCard({ offer, showWishlistButton = false, layout = 'rail', showCategoryBadge = true, distanceKm }: OfferCardProps) {
  const { t, lang } = useLang()
  const title = localizeText(offer.title, offer.translations, lang, 'title')
  const name = localizedBusinessName(offer, lang)
  const place = offerPlaceLabel(offer, lang)
  const hasDistance = typeof distanceKm === 'number'
  const rail = layout === 'rail'
  const { user } = useAuth()
  const { isWishlisted, toggleWishlist } = useWishlist()
  const tile = CATEGORY_TILES.find((c) => c.category === offer.category)
  const discount = getOfferDiscountPercent(offer.originalPrice, offer.offerPrice)
  const saved = isWishlisted(offer.id)

  return (
    <Link
      href={`/offers/${offer.id}`}
      className={`group flex flex-col overflow-hidden rounded-2xl border border-line bg-white shadow-card transition-[box-shadow,transform,border-color] duration-200 ease-out-expo focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand active:scale-[0.98] motion-reduce:transition-none [@media(hover:hover)]:hover:border-slate-300 [@media(hover:hover)]:hover:shadow-card-hover motion-reduce:[@media(hover:hover)]:hover:translate-y-0 ${
        // A rail scrolls sideways, so it clips anything that rises above it: 2px there, 4px in a grid.
        rail ? 'w-[clamp(240px,72vw,260px)] flex-shrink-0 [@media(hover:hover)]:hover:-translate-y-0.5' : 'w-full [@media(hover:hover)]:hover:-translate-y-1'
      }`}
    >
      {/* The framed picture: 16:9 in every layout, as in the Expo app, with the
          business's logo tile hanging half over its foot at the start edge
          (outside the clipped frame, so it mirrors in Hebrew and isn't cut). */}
      <div className="relative z-[1] mx-2 mt-2">
        <div className="relative aspect-video overflow-hidden rounded-[14px] border border-line bg-canvas">
          <PerkImage src={offer.imageUrl} alt={title.text} category={offer.category} businessName={name.text} />
          {showCategoryBadge && tile && (
            <span className="absolute top-2.5 start-2.5 max-w-[65%] truncate rounded-full bg-white/95 px-2.5 py-1 text-micro font-semibold text-ink shadow-sm">
              {t(tile.labelKey)}
            </span>
          )}
          {showWishlistButton && user && (
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                toggleWishlist(offer.id)
              }}
              aria-pressed={saved}
              aria-label={saved ? t('btn_remove_from_wishlist') : t('btn_add_to_wishlist')}
              // A 48px tap target around a 36px visible circle.
              className="absolute top-0 end-0 flex h-12 w-12 items-center justify-center"
            >
              <span
                className={`flex h-9 w-9 items-center justify-center rounded-full shadow-sm transition-colors ${
                  saved ? 'bg-red-500 text-white' : 'bg-white/95 text-body [@media(hover:hover)]:hover:text-red-500'
                }`}
              >
                <Heart aria-hidden="true" className={`h-4 w-4 ${saved ? 'fill-current' : ''}`} strokeWidth={2} />
              </span>
            </button>
          )}
        </div>
        <MerchantBadge logoUrl={offer.businessLogoUrl ?? ''} businessName={name.text} className="absolute start-2 -bottom-6" />
      </div>

      <div className={`flex flex-1 flex-col ${rail ? 'px-3 pb-3 pt-2.5' : 'px-3 pb-3 pt-2.5 sm:px-4 sm:pb-4'}`}>
        {/* Clear of the logo tile: its 16px inset and 48px width plus 8px, less the body's 12px padding. */}
        <div className="truncate ps-[60px] text-micro font-bold uppercase leading-snug tracking-wider rtl:tracking-normal text-slate-500" lang={name.lang ?? undefined} dir="auto">
          {name.text}
        </div>
        {/* A rail keeps two lines reserved so neighbouring cards line up; a grid row stretches its cards anyway. */}
        <p className={`mt-1 line-clamp-2 font-bold leading-snug text-ink ${rail ? 'min-h-[2.5em] text-copy' : 'text-base'}`} lang={title.lang ?? undefined} dir="auto">
          {title.text}
        </p>

        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <RedemptionBadge method={offer.redemptionMethod} />
          {(place || hasDistance) && (
            <span className="inline-flex min-w-0 max-w-full items-center gap-1 rounded-full border border-slate-200/80 bg-slate-50 px-2 py-0.5 text-micro font-medium text-body">
              <MapPin aria-hidden="true" className="h-3 w-3 flex-shrink-0 text-slate-400" strokeWidth={1.5} />
              {/* <bdi>: "1.2 ק״מ" keeps its order inside a Hebrew or English line. */}
              {typeof distanceKm === 'number' && <bdi className="flex-shrink-0 font-semibold text-brand">{formatDistance(distanceKm, lang)}</bdi>}
              {hasDistance && place && <span aria-hidden="true">·</span>}
              {place && <span className="truncate" dir="auto">{place}</span>}
            </span>
          )}
        </div>

        {/* Price at the start, "View deal" at the end, on one row. */}
        <div className={`mt-auto flex items-center justify-between pt-2.5 ${rail ? 'gap-2' : 'gap-3'}`}>
          {/* The badge sits in the price row, never over the picture, outside the
              prices' left-to-right run so "15% הנחה" still reads in Hebrew order. */}
          <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
            <div className="flex min-w-0 flex-wrap items-baseline gap-x-2">
              <bdi className="text-price tabular-nums text-brand">{formatPrice(offer.offerPrice)}</bdi>
              {discount > 0 && (
                <bdi className="text-price-was tabular-nums text-slate-400 line-through decoration-slate-400/70">{formatPrice(offer.originalPrice)}</bdi>
              )}
            </div>
            <DiscountBadge percent={discount} size="sm" />
          </div>
          <span className={`flex flex-shrink-0 items-center gap-1.5 font-semibold text-brand ${rail ? 'text-meta' : 'text-sm'}`}>
            <span>{t('offer_view_cta')}</span>
            <ArrowRight
              aria-hidden="true"
              className="h-3.5 w-3.5 transition-transform rtl:-scale-x-100 [@media(hover:hover)]:group-hover:translate-x-0.5 rtl:[@media(hover:hover)]:group-hover:-translate-x-0.5"
              strokeWidth={2.25}
            />
          </span>
        </div>
      </div>
    </Link>
  )
}

'use client'

import Link from 'next/link'
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
import PerkImage from './PerkImage'
import RedemptionBadge from './RedemptionBadge'

/**
 * The perk feeds (/categories results, category folders, New, Bestsellers, Wishlist):
 * one full-width card per row on phones, then two and three columns.
 */
export const OFFER_FEED_GRID = 'grid grid-cols-1 gap-3 md:grid-cols-2 md:gap-4 lg:grid-cols-3'

interface OfferCardProps {
  offer: OfferDocument
  showWishlistButton?: boolean
  /**
   * 'rail': a compact, fixed-width card for a horizontal scroller (240-260px,
   * a 124px photo, smaller type), so the next card peeks in. 'grid': fills its grid cell.
   */
  layout?: 'rail' | 'grid'
  /** The category pill on the photo. Off in a list already scoped to one category, where every card would repeat it. */
  showCategoryBadge?: boolean
  /** Kilometres from the member's location (Near me), shown before the place; undefined without one. */
  distanceKm?: number | null
}

// A perk: photo (or branded fallback) with its category badge, then the
// business, the offer, where and how it's redeemed, and the price. The whole
// card is the link; the footer line only says what tapping does. The lift on
// hover is limited to devices that really hover, so a tap never leaves a
// phone's card stuck raised. Compact, so a phone's feed shows more than one
// perk per screen: a 2:1 photo, tight padding, and the price sharing one row
// with the CTA. Same anatomy as the Expo app's OfferCard.
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
      className={`group flex flex-col overflow-hidden rounded-2xl border border-[#E2E8F0] bg-white shadow-sm transition-[box-shadow,transform,border-color] duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0038B8] motion-reduce:transition-none [@media(hover:hover)]:hover:-translate-y-0.5 [@media(hover:hover)]:hover:border-[#CBD5E1] [@media(hover:hover)]:hover:shadow-md motion-reduce:[@media(hover:hover)]:hover:translate-y-0 ${
        rail ? 'w-[clamp(240px,72vw,260px)] flex-shrink-0' : 'w-full'
      }`}
    >
      {/* A full-width card on a phone gets a wide photo (2:1, capped at 180px, as in the Expo app) so the image doesn't crowd out the text; a rail card a short fixed one. */}
      <div className={`relative overflow-hidden bg-[#F0F7FF] ${rail ? 'h-[124px]' : 'aspect-[2/1] max-h-[180px] md:aspect-[16/10] md:max-h-none'}`}>
        <PerkImage src={offer.imageUrl} alt={title.text} category={offer.category} businessName={name.text} />
        {showCategoryBadge && tile && (
          <span className="absolute top-2.5 start-2.5 max-w-[65%] truncate rounded-full bg-white/95 px-2.5 py-1 text-[11px] font-semibold text-[#0B1B3D] shadow-sm">
            {t(tile.labelKey)}
          </span>
        )}
        <DiscountBadge percent={discount} size={rail ? 'sm' : 'md'} className="absolute bottom-2.5 start-2.5" />
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
                saved ? 'bg-red-500 text-white' : 'bg-white/95 text-[#475569] [@media(hover:hover)]:hover:text-red-500'
              }`}
            >
              <i className={`${saved ? 'fa-solid' : 'fa-regular'} fa-heart text-sm`} aria-hidden="true"></i>
            </span>
          </button>
        )}
      </div>

      <div className={`flex flex-1 flex-col ${rail ? 'p-3' : 'p-3 sm:p-4'}`}>
        <div className={`truncate font-bold leading-snug text-[#0B1B3D] ${rail ? 'text-[15px]' : 'text-base'}`} lang={name.lang ?? undefined} dir="auto">
          {name.text}
        </div>
        {/* A rail keeps two lines reserved so neighbouring cards line up; a grid row stretches its cards anyway. */}
        <p className={`mt-0.5 line-clamp-2 leading-snug text-[#475569] ${rail ? 'min-h-[2.5em] text-[13px]' : 'text-sm'}`} lang={title.lang ?? undefined} dir="auto">
          {title.text}
        </p>

        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <RedemptionBadge method={offer.redemptionMethod} />
          {(place || hasDistance) && (
            <span className="inline-flex min-w-0 max-w-full items-center gap-1 text-[11px] text-[#94A3B8]">
              <i className="fa-solid fa-location-dot text-[10px]" aria-hidden="true"></i>
              {/* <bdi>: "1.2 ק״מ" keeps its order inside a Hebrew or English line. */}
              {typeof distanceKm === 'number' && <bdi className="flex-shrink-0 font-semibold text-[#0038B8]">{formatDistance(distanceKm, lang)}</bdi>}
              {hasDistance && place && <span aria-hidden="true">·</span>}
              {place && <span className="truncate" dir="auto">{place}</span>}
            </span>
          )}
        </div>

        {/* Price at the start, "View deal" at the end, on one row. */}
        <div className={`mt-auto flex items-center justify-between pt-2.5 ${rail ? 'gap-2' : 'gap-3'}`}>
          <div className="flex min-w-0 flex-wrap items-baseline gap-x-2" dir="ltr">
            <span className={`font-extrabold tracking-tight text-[#0038B8] ${rail ? 'text-base' : 'text-lg'}`}>{formatPrice(offer.offerPrice)}</span>
            {discount > 0 && (
              <span className={`text-[#94A3B8] line-through decoration-[#94A3B8]/70 ${rail ? 'text-xs' : 'text-sm'}`}>{formatPrice(offer.originalPrice)}</span>
            )}
          </div>
          <span className={`flex flex-shrink-0 items-center gap-1.5 font-semibold text-[#0038B8] ${rail ? 'text-[13px]' : 'text-sm'}`}>
            <span>{t('offer_view_cta')}</span>
            <i
              className="fa-solid fa-arrow-right text-[11px] transition-transform rtl:-scale-x-100 [@media(hover:hover)]:group-hover:translate-x-0.5 rtl:[@media(hover:hover)]:group-hover:-translate-x-0.5"
              aria-hidden="true"
            ></i>
          </span>
        </div>
      </div>
    </Link>
  )
}

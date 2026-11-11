'use client'

import Link from 'next/link'
import { Heart, MapPin } from 'lucide-react'
import { useLang } from '@/lib/i18n/useLang'
import { useAuth } from '@/lib/firebase/useAuth'
import { useWishlist } from '@/lib/firebase/useWishlist'
import { getOfferDiscountPercent, type OfferDocument } from '@/lib/firebase/offers'
import { formatPrice } from '@/lib/format'
import { localizeText } from '@/lib/i18n/contentTranslation'
import { localizedBusinessName } from '@/lib/business/businessText'
import { badgeLogoUri } from '@/lib/offers/dealImage'
import { CATEGORY_TILES } from '@/lib/categories'
import { REDEMPTION_METHOD_LABEL_KEYS } from '@/lib/offers/redemption'
import { formatDistance, offerPlaceLabel } from '@/lib/geo'
import DealMedia from './DealMedia'
import { isMultiChain, PerkReachLine } from './PerkReach'
import DiscountBadge from './DiscountBadge'
import MerchantBadge from './MerchantBadge'
import CategoryIcon from '@/components/ui/CategoryIcon'
import { useDealImage } from './useDealImage'

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
  className?: string
  /** The category in the tag line under the photo. Off in a list already scoped to one category, where every card would repeat it. */
  showCategoryBadge?: boolean
  /** Kilometres from the member's location (Near me), shown before the place; undefined without one. */
  distanceKm?: number | null
}

// A perk, the same card everywhere and as the Expo app's OfferCard: a full-width
// 2:1 hero capped at 172px (DealMedia.tsx), then a white body with the offer, the
// business and where on one line, and the price. Over the hero: the redemption
// method tag at the top start corner, the discount ribbon tied to the top end corner, the heart at the bottom end, and
// the business's logo box across the bottom start corner. The whole card is the
// link, with no "View deal" text: it lifts under a real pointer and presses in
// under a finger. The lift on hover is limited to devices that really hover,
// so a tap never leaves a phone's card stuck raised. Prices sit in <bdi> in the
// body font, "₪" included, so the symbol and digits never mix fonts. Every
// position is start/end, so Hebrew mirrors the card.
export default function OfferCard({ offer, showWishlistButton = false, layout = 'rail', className = '', showCategoryBadge = true, distanceKm }: OfferCardProps) {
  const { t, lang } = useLang()
  const title = localizeText(offer.title, offer.translations, lang, 'title')
  const name = localizedBusinessName(offer, lang)
  const place = offerPlaceLabel(offer, lang)
  const hasDistance = typeof distanceKm === 'number'
  const rail = layout === 'rail'
  const multiChain = isMultiChain(offer)
  // A Multipass perk has no street address: the chains (or "nationwide") say where it works.
  const reach = multiChain || (offer.fulfillmentType === 'multipass_pool' && !place)
  const image = useDealImage(offer.imageUrl)
  const { user } = useAuth()
  const { isWishlisted, toggleWishlist } = useWishlist()
  const discount = getOfferDiscountPercent(offer.originalPrice, offer.offerPrice)
  const saved = isWishlisted(offer.id)
  const categoryTile = CATEGORY_TILES.find((c) => c.category === offer.category)

  return (
    <Link
      href={`/offers/${offer.id}`}
      // A rail scrolls sideways, so it keeps 4px of room above its cards for the lift.
      className={`group flex flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_4px_20px_-4px_rgba(0,0,0,0.07)] transition-[box-shadow,transform,border-color] duration-200 ease-out-expo focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand active:scale-[0.98] motion-reduce:transition-none [@media(hover:hover)]:hover:border-slate-300 [@media(hover:hover)]:hover:shadow-card-hover motion-reduce:[@media(hover:hover)]:hover:translate-y-0 ${
        rail ? 'w-[clamp(240px,72vw,260px)] flex-shrink-0 [@media(hover:hover)]:hover:-translate-y-1' : 'w-full [@media(hover:hover)]:hover:-translate-y-1'
      } ${className}`}
    >
      <DealMedia src={offer.imageUrl} image={image} alt={title.text} category={offer.category} aspect={rail ? 'aspect-video max-h-[172px]' : 'aspect-[2/1] max-h-[172px]'}>
        <DiscountBadge percent={discount} />
        {/* How it's redeemed (and, in a mixed feed, a category mark) over the photo's top start corner. */}
        <span className="absolute start-2.5 top-2.5 flex max-w-[60%] items-center gap-1 rounded-full bg-white/90 px-2 py-0.5 text-micro font-semibold text-body backdrop-blur-sm">
          {showCategoryBadge && (
            <>
              <CategoryIcon category={offer.category} className="h-3 w-3 shrink-0" strokeWidth={1.5} />
              {/* The mark is a picture; the name is for screen readers. */}
              <span className="sr-only">{categoryTile ? t(categoryTile.labelKey) : offer.category}</span>
            </>
          )}
          <span className="truncate">{multiChain ? t('perk_multi_chain_badge') : t(REDEMPTION_METHOD_LABEL_KEYS[offer.redemptionMethod])}</span>
        </span>
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
            // A 48px tap target around a 36px visible circle, 10px off the hero's corner.
            className="absolute bottom-1 end-1 flex h-12 w-12 items-center justify-center"
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
        <span className="absolute -bottom-4 start-3"><MerchantBadge size="sm" logoUrl={badgeLogoUri(offer.businessLogoUrl ?? '', offer.imageUrl, image.role) ?? ''} businessName={name.text} /></span>
      </DealMedia>

      <div className="flex flex-1 flex-col p-3 pt-[22px]">
        {/* Cards in a row stretch to the tallest, and the price rides the foot (mt-auto), so no title lines are reserved. */}
        <p className="line-clamp-2 text-[15px] font-bold leading-tight text-ink">
          <bdi lang={title.lang ?? undefined} dir="auto">{title.text}</bdi>
        </p>
        {/* One dense line: the business, then where (or how far). */}
        <div className="mt-[3px] flex min-w-0 items-center gap-1 text-meta leading-snug text-body">
          <bdi className="min-w-0 truncate" lang={name.lang ?? undefined} dir="auto">{name.text}</bdi>
          {reach && (
            <>
              <span aria-hidden="true" className="text-slate-400">·</span>
              <PerkReachLine offer={offer} hasPlace={!!place} className="text-micro text-muted" />
            </>
          )}
          {!reach && (place || hasDistance) && (
            <>
              <span aria-hidden="true" className="text-slate-400">·</span>
              <MapPin aria-hidden="true" className={`h-3 w-3 flex-shrink-0 ${hasDistance ? 'text-brand' : 'text-slate-400'}`} strokeWidth={1.75} />
              {/* <bdi>: "1.2 ק״מ" keeps its order inside a Hebrew or English line. */}
              {typeof distanceKm === 'number' && <bdi className="flex-shrink-0 text-micro font-semibold text-brand">{formatDistance(distanceKm, lang)}</bdi>}
              {hasDistance && place && <span aria-hidden="true" className="text-micro text-muted">·</span>}
              {place && <bdi className="min-w-0 flex-shrink-[2] truncate text-micro font-medium text-muted" dir="auto">{place}</bdi>}
            </>
          )}
        </div>

        {/* One baseline at the card's foot: the price, then the struck-through original. Always left to right, "₪" included. */}
        <div className="mt-auto flex flex-nowrap items-baseline gap-x-2 whitespace-nowrap pt-1.5">
          <bdi dir="ltr" className="text-price tabular-nums text-brand">{formatPrice(offer.offerPrice)}</bdi>
          {discount > 0 && (
            <bdi dir="ltr" className="text-price-was tabular-nums text-slate-400 line-through decoration-slate-400/70">{formatPrice(offer.originalPrice)}</bdi>
          )}
        </div>
      </div>
    </Link>
  )
}

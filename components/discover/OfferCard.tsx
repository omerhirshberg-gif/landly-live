'use client'

import { memo } from 'react'
import Link from 'next/link'
import { Globe, Heart, MapPin, Store } from 'lucide-react'
import { useLang } from '@/lib/i18n/useLang'
import { useAuth } from '@/lib/firebase/useAuth'
import { useIsWishlisted, useToggleWishlist } from '@/lib/firebase/useWishlist'
import { getOfferDiscountPercent, type OfferDocument } from '@/lib/firebase/offers'
import { formatPrice } from '@/lib/format'
import { localizeText } from '@/lib/i18n/contentTranslation'
import { localizedBusinessName } from '@/lib/business/businessText'
import { badgeLogoUri } from '@/lib/offers/dealImage'
import { CATEGORY_TILES } from '@/lib/categories'
import { redemptionChannel, redemptionTagKey } from '@/lib/offers/redemption'
import { formatDistance, offerPlaceLabel } from '@/lib/geo'
import DealMedia from './DealMedia'
import { isRaayonitOffer, logoOnlyHero, raayonitImageOpts } from '@/lib/offers/logoOnly'
import { RAAYONIT_LOGO_PATH } from '@/lib/payments/issuer'
import { isMultiChain, PerkReachLine } from './PerkReach'
import { locationNoticeKind } from '@/lib/offers/locationVisibility'
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
  /** Denser on desktop (from 1024px): a shorter photo, tighter body and a 14px title. Phones are unchanged. Home's rails only. */
  compact?: boolean
  /** The category in the tag line under the photo. Off in a list already scoped to one category, where every card would repeat it. */
  showCategoryBadge?: boolean
  /** Kilometres from the member's location (Near me), shown before the place; undefined without one. */
  distanceKm?: number | null
  /** Above the fold (the first cards of the first rail): its photo loads first, eagerly, instead of lazily. */
  priority?: boolean
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
//
// Memoized: a rail or grid re-rendering around it (a search keystroke, a
// filter, a heart saved on another card) leaves it alone. Its heart subscribes
// to its own offer id only (useIsWishlisted), and flips on the click's frame.
export default memo(function OfferCard({ offer, showWishlistButton = false, layout = 'rail', className = '', compact = false, showCategoryBadge = true, distanceKm, priority = false }: OfferCardProps) {
  const { t, lang } = useLang()
  const title = localizeText(offer.title, offer.translations, lang, 'title')
  const name = localizedBusinessName(offer, lang)
  // A single venue says where it is, from its address, else its city (never "valid at 1 store" or the redemption method).
  const place = offerPlaceLabel(offer, lang)
  const hasDistance = typeof distanceKm === 'number'
  const rail = layout === 'rail'
  const multiChain = isMultiChain(offer)
  // Online, online and in store, or in store: the tag over the photo, and an online store has no street to show.
  const channel = redemptionChannel(offer)
  const onlineOnly = channel === 'online'
  const ChannelIcon = channel === 'in_store' ? Store : Globe
  // A multi-branch perk has no street address: the chains or the branch-validity notice say where it works.
  const reach = locationNoticeKind(offer) !== null
  const image = useDealImage(offer.imageUrl, raayonitImageOpts(offer))
  const hero = logoOnlyHero(offer)
  const heroLogo = hero ? { src: hero.kind === 'issuer' ? RAAYONIT_LOGO_PATH : hero.logoUrl, alt: name.text, small: hero.kind === 'brand' ? hero.fallback : hero.small } : null
  const { user } = useAuth()
  const saved = useIsWishlisted(offer.id)
  const toggleWishlist = useToggleWishlist()
  const multiValue = (offer.variants?.length ?? 0) > 1
  const discount = getOfferDiscountPercent(offer.originalPrice, offer.offerPrice)
  const categoryTile = CATEGORY_TILES.find((c) => c.category === offer.category)

  return (
    <Link
      href={`/offers/${offer.id}`}
      // A rail scrolls sideways, so it keeps 4px of room above its cards for the lift.
      className={`group flex h-full flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_4px_20px_-4px_rgba(0,0,0,0.07)] transition-[box-shadow,transform,border-color] duration-200 ease-out-expo focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand active:scale-[0.98] motion-reduce:transition-none [@media(hover:hover)]:hover:border-slate-300 [@media(hover:hover)]:hover:shadow-card-hover motion-reduce:[@media(hover:hover)]:hover:translate-y-0 ${
        rail ? 'w-[clamp(240px,72vw,260px)] flex-shrink-0 sm:w-[280px] [@media(hover:hover)]:hover:-translate-y-1' : 'w-full [@media(hover:hover)]:hover:-translate-y-1'
      } ${className}`}
    >
      <DealMedia src={offer.imageUrl} image={image} priority={priority} alt={title.text} category={offer.category} logo={heroLogo} aspect={rail ? 'aspect-[16/10] max-h-40' : 'aspect-[2/1] max-h-[172px]'}>
        <DiscountBadge percent={discount} />
        {/* How it's redeemed (and, in a mixed feed, a category mark) over the photo's top start corner. */}
        <span className="absolute start-2.5 top-2.5 flex max-w-[calc(100%-4.5rem)] items-center gap-1 rounded-full bg-white/95 px-2 py-0.5 text-micro font-semibold text-body">
          {showCategoryBadge && (
            <>
              <CategoryIcon category={offer.category} className="h-3 w-3 shrink-0" strokeWidth={1.5} />
              {/* The mark is a picture; the name is for screen readers. */}
              <span className="sr-only">{categoryTile ? t(categoryTile.labelKey) : offer.category}</span>
            </>
          )}
          {!multiChain && (offer.redemptionMethod === 'in_store' || offer.redemptionMethod === 'online') && <ChannelIcon aria-hidden="true" className="h-3 w-3 shrink-0" strokeWidth={1.75} />}
          <span className="truncate">{multiChain ? t('perk_multi_chain_badge') : t(redemptionTagKey(offer))}</span>
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
        {!heroLogo && !isRaayonitOffer(offer) && <span className="absolute -bottom-4 start-3"><MerchantBadge size="sm" logoUrl={badgeLogoUri(offer.businessLogoUrl ?? '', offer.imageUrl, image.role) ?? ''} /></span>}
      </DealMedia>

      <div className={`flex flex-1 flex-col p-3 ${heroLogo ? 'pt-3' : 'pt-[22px]'}`}>
        {/* Cards in a row stretch to the tallest, and the price rides the foot (mt-auto), so no title lines are reserved. */}
        <p className={`line-clamp-2 text-[15px] font-bold leading-tight text-ink`}>
          <bdi lang={title.lang ?? undefined} dir="auto">{title.text}</bdi>
        </p>
        {/* The business on its own line, then where (or how far) on a full-width line below, so a long notice wraps whole. */}
        <bdi className="mt-[3px] block min-w-0 truncate text-meta leading-snug text-body" lang={name.lang ?? undefined} dir="auto">{name.text}</bdi>
        {/* The foot: where it is, then the price, pinned together to the card's bottom edge (mt-auto) so every card in a row lines up. */}
        <div className="mt-auto pt-2">
          {onlineOnly ? (
            <div className="flex min-w-0 items-center gap-1 text-micro leading-4">
              <Globe aria-hidden="true" className="h-3 w-3 flex-shrink-0 text-brand" strokeWidth={1.75} />
              <span className="truncate font-medium text-muted">{t('perk_online_store')}</span>
            </div>
          ) : reach ? (
            <PerkReachLine offer={offer} className="text-micro leading-4 text-muted" />
          ) : (place || hasDistance) ? (
            <div className="flex min-w-0 items-center gap-1 text-micro leading-4">
              <MapPin aria-hidden="true" className={`h-3 w-3 flex-shrink-0 ${hasDistance ? 'text-brand' : 'text-slate-400'}`} strokeWidth={1.75} />
              {/* <bdi>: "1.2 ק״מ" keeps its order inside a Hebrew or English line. */}
              {typeof distanceKm === 'number' && <bdi className="flex-shrink-0 font-semibold text-brand">{formatDistance(distanceKm, lang)}</bdi>}
              {hasDistance && place && <span aria-hidden="true" className="text-muted">·</span>}
              {place && <bdi className="truncate font-medium text-muted" dir="auto">{place}</bdi>}
            </div>
          ) : null}

          {/* One baseline at the card's foot: the price, then the struck-through original. Always left to right, "₪" included. */}
          <div className="mt-1.5 flex flex-nowrap items-baseline gap-x-2 whitespace-nowrap">
          {multiValue ? (
            <>
              {/* "From ₪89" with the values on offer: the card is one per brand, the member picks the value on its page. */}
              <span className="text-price text-brand">
                {t('offer_card_from').split('{price}').map((part, i) => (i === 0 ? part : <span key="p"><bdi dir="ltr" className="tabular-nums">{formatPrice(offer.offerPrice)}</bdi>{part}</span>))}
              </span>
              <bdi dir="ltr" className="self-center rounded-lg bg-slate-100 px-1.5 py-0.5 text-[11px] font-bold tabular-nums leading-4 text-body">{offer.variants!.map((v) => v.faceValueAgorot / 100).join(' / ')} ₪</bdi>
            </>
          ) : (
            <>
              <bdi dir="ltr" className="text-price tabular-nums text-brand">{formatPrice(offer.offerPrice)}</bdi>
              {discount > 0 && (
                <bdi dir="ltr" className="text-price-was tabular-nums text-slate-400 line-through decoration-slate-400/70">{formatPrice(offer.originalPrice)}</bdi>
              )}
            </>
          )}
          </div>
        </div>
      </div>
    </Link>
  )
})

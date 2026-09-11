'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useLang } from '@/lib/i18n/useLang'
import { useAuth } from '@/lib/firebase/useAuth'
import { useWishlist } from '@/lib/firebase/useWishlist'
import { CATEGORY_TILES } from '@/lib/categories'
import { getOfferDiscountPercent, type OfferDocument } from '@/lib/firebase/offers'
import { formatPrice } from '@/lib/format'

export default function OfferCard({ offer, showWishlistButton = false }: { offer: OfferDocument; showWishlistButton?: boolean }) {
  const { t } = useLang()
  const { user } = useAuth()
  const { isWishlisted, toggleWishlist } = useWishlist()
  const [imgError, setImgError] = useState(false)
  const tile = CATEGORY_TILES.find((c) => c.category === offer.category)
  const showImage = !!offer.imageUrl && !imgError

  return (
    <Link
      href={`/offers/${offer.id}`}
      className="flex-shrink-0 w-[180px] sm:w-[200px] bg-white border border-slate-100 rounded-2xl overflow-hidden hover:border-brand hover:shadow-md transition block"
    >
      <div className="relative aspect-[4/3] bg-slate-50 flex items-center justify-center">
        {showImage ? (
          // Pasted external links (Drive/Imgur/etc.), not a whitelisted domain — plain <img> avoids next/image's remote-pattern config.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={offer.imageUrl} alt={offer.title} onError={() => setImgError(true)} className="w-full h-full object-cover" />
        ) : (
          <i className="fa-regular fa-image text-3xl text-slate-300"></i>
        )}
        {tile && (
          <span className="absolute top-2.5 start-2.5 bg-white/95 text-[10px] font-bold text-slate-500 px-2 py-0.5 rounded-full shadow-sm">
            {t(tile.labelKey)}
          </span>
        )}
        {showWishlistButton && user && (
          <button
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              toggleWishlist(offer.id)
            }}
            aria-pressed={isWishlisted(offer.id)}
            aria-label={isWishlisted(offer.id) ? t('btn_remove_from_wishlist') : t('btn_add_to_wishlist')}
            className={`tap-target absolute top-2.5 end-2.5 w-8 h-8 flex items-center justify-center rounded-full shadow-sm transition ${isWishlisted(offer.id) ? 'bg-red-500 text-white' : 'bg-white/90 text-slate-500 hover:text-red-500'}`}
          >
            <i className={`${isWishlisted(offer.id) ? 'fa-solid' : 'fa-regular'} fa-heart text-xs`}></i>
          </button>
        )}
      </div>
      <div className="p-2.5">
        <div className="font-bold text-slate-900 text-xs truncate">{offer.businessName}</div>
        {offer.location && <div className="text-[11px] text-slate-400 mt-0.5 truncate">{offer.location}</div>}
        <div className="text-xs text-slate-700 mt-1.5 truncate">{offer.title}</div>
        <div className="flex items-center gap-1 mt-2" dir="ltr">
          <span className="text-sm font-black text-brand">{formatPrice(offer.offerPrice)}</span>
          <span className="text-[11px] text-slate-400 line-through">{formatPrice(offer.originalPrice)}</span>
          <span className="deal-badge !mb-0">-{getOfferDiscountPercent(offer.originalPrice, offer.offerPrice)}%</span>
        </div>
      </div>
    </Link>
  )
}

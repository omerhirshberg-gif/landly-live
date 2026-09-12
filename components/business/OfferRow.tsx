'use client'

import { useBusinessLang } from '@/lib/business/BusinessLangProvider'
import { formatPrice } from '@/lib/format'

interface BusinessOffer {
  id: string
  title: string
  offerPrice: number
  totalQuantity: number | null
  claimedCount: number
}

// Shared row treatment for a single offer -- used by both Live Offers and
// Top Offer so an offer looks identical wherever it appears on the
// dashboard (same border, padding, layout), regardless of which card is
// showing it.
export default function OfferRow({ offer }: { offer: BusinessOffer }) {
  const { t } = useBusinessLang()
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-white/5 bg-white/[0.03] px-3.5 py-2.5">
      <div className="min-w-0">
        <div className="text-white font-bold text-sm truncate">{offer.title}</div>
        <div className="text-slate-400 text-xs font-semibold mt-0.5" dir="ltr">
          {formatPrice(offer.offerPrice)}
        </div>
      </div>
      <div className="text-slate-500 text-xs font-semibold shrink-0">
        {offer.claimedCount}/{offer.totalQuantity ?? '∞'} {t('bizdash_offers_claimed_label')}
      </div>
    </div>
  )
}

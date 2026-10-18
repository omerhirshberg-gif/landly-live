import { formatPrice } from '@/lib/format'
import { getOfferDiscountPercent } from '@/lib/firebase/offers'

/** "₪80 ₪100 -20%" -- always LTR so the symbol and minus sign stay put. */
export default function OfferPrice({ offerPrice, originalPrice }: { offerPrice: number; originalPrice: number }) {
  return (
    <span className="inline-flex items-baseline gap-1.5 tabular-nums" dir="ltr">
      <span className="font-semibold text-[#0B1B3D]">{formatPrice(offerPrice)}</span>
      <span className="text-xs text-[#94A3B8] line-through">{formatPrice(originalPrice)}</span>
      <span className="text-xs font-semibold text-emerald-700">-{getOfferDiscountPercent(originalPrice, offerPrice)}%</span>
    </span>
  )
}

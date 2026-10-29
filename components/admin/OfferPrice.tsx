import { formatPrice } from '@/lib/format'
import { discountPercent } from '@/lib/perks/perksFilter'

/**
 * "₪15 (-38%)" over a struck-through "₪24": the price members pay and its
 * discount first, the original price quieter on a second line. Each line is
 * isolated LTR so the shekel sign and minus sign stay put next to Hebrew.
 * `align="end"` lines both up with a right-aligned (end) table column.
 */
export default function OfferPrice({ offerPrice, originalPrice, align = 'start' }: { offerPrice: number; originalPrice: number; align?: 'start' | 'end' }) {
  const percent = discountPercent(originalPrice, offerPrice)
  return (
    <span className={`inline-flex flex-col gap-0.5 tabular-nums leading-tight ${align === 'end' ? 'items-end' : 'items-start'}`}>
      <bdi dir="ltr" className="whitespace-nowrap">
        <span className="font-semibold text-[#0B1B3D]">{formatPrice(offerPrice)}</span>
        {percent > 0 && <span className="ms-1 text-xs font-semibold text-emerald-700">(-{percent}%)</span>}
      </bdi>
      {originalPrice > offerPrice && (
        <bdi dir="ltr" className="whitespace-nowrap text-xs text-[#94A3B8] line-through">
          {formatPrice(originalPrice)}
        </bdi>
      )}
    </span>
  )
}

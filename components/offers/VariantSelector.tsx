'use client'

import { useId } from 'react'
import { formatPrice } from '@/lib/format'
import { variantDiscountPercent, type OfferVariant } from '@/lib/offers/variants'
import { useLang } from '@/lib/i18n/useLang'

// Native: landly-mobile/src/components/VariantSelector.tsx. A radio group above the price and the Buy button: each segment
// states what the voucher is worth, what it costs and the saving; picking one re-prices the page and the checkout.
export default function VariantSelector({ variants, value, onChange, claimed = [] }: {
  variants: OfferVariant[]
  value: string
  onChange: (poolId: string) => void
  /** Stocks the member already holds a voucher for: shown, but not selectable. */
  claimed?: readonly string[]
}) {
  const { t } = useLang()
  const legend = useId()
  return (
    <div role="radiogroup" aria-labelledby={legend} className="mt-5">
      <p id={legend} className="mb-2 text-sm font-bold text-ink">{t('offer_variant_group')}</p>
      <div className="grid grid-cols-2 gap-2.5">
        {variants.map((v) => {
          const selected = v.poolId === value
          const taken = claimed.includes(v.poolId)
          const off = variantDiscountPercent(v)
          return (
            <button
              key={v.poolId}
              type="button"
              role="radio"
              aria-checked={selected}
              disabled={taken}
              onClick={() => onChange(v.poolId)}
              className={`flex min-h-16 flex-col justify-center gap-0.5 rounded-2xl border px-3.5 py-2.5 text-start transition-[border-color,background-color,box-shadow] duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:cursor-not-allowed disabled:opacity-45 ${
                selected ? 'border-brand bg-brandTint shadow-[0_0_0_1px_#0038b8]' : 'border-slate-200 bg-white [@media(hover:hover)]:hover:border-slate-300 [@media(hover:hover)]:hover:bg-slate-50'
              }`}
            >
              <bdi dir="ltr" className={`text-[15px] font-bold tabular-nums ${selected ? 'text-brand' : 'text-slate-700'}`}>{t('offer_variant_worth').replace('{face}', formatPrice(v.faceValueAgorot / 100))}</bdi>
              <span className="flex items-baseline gap-2">
                <bdi dir="ltr" className={`text-[13px] tabular-nums ${selected ? 'text-ink' : 'text-body'}`}>{t('offer_variant_pay').replace('{price}', formatPrice(v.priceAgorot / 100))}</bdi>
                {off > 0 && <bdi dir="ltr" className="text-xs font-bold tabular-nums text-emerald-700">{t('offer_variant_off').replace('{n}', String(off))}</bdi>}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

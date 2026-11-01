'use client'

import CategoryIcon from '@/components/ui/CategoryIcon'
import { CATEGORY_TILES } from '@/lib/categories'
import { useLang } from '@/lib/i18n/useLang'
import { REDEMPTION_METHOD_LABEL_KEYS, type RedemptionMethod } from '@/lib/offers/redemption'

// What kind of perk this is and how it's redeemed, as one quiet line under the
// photo, on the card and the offer page alike (the app: OfferTags.tsx). A long
// category gives way to the method. `showCategory` is off in a list already
// scoped to one category, where every card would repeat it.
export default function OfferTags({ category, method, showCategory = true, className = '' }: { category: string; method: RedemptionMethod; showCategory?: boolean; className?: string }) {
  const { t } = useLang()
  const tile = CATEGORY_TILES.find((c) => c.category === category)
  return (
    <div className={`flex items-center gap-2 py-1 text-xs font-medium text-slate-600 ${className}`}>
      {showCategory && (
        <>
          <span className="inline-flex min-w-0 items-center gap-1.5">
            {tile && <CategoryIcon category={tile.category} className="h-3.5 w-3.5 shrink-0" strokeWidth={1.75} />}
            <span className="truncate">{tile ? t(tile.labelKey) : <span dir="auto">{category}</span>}</span>
          </span>
          <span aria-hidden="true" className="text-slate-400">·</span>
        </>
      )}
      <span className="shrink-0">{t(REDEMPTION_METHOD_LABEL_KEYS[method])}</span>
    </div>
  )
}

'use client'

import { useMemo } from 'react'
import { Layers } from 'lucide-react'
import { useLang } from '@/lib/i18n/useLang'
import { isolateLtr } from '@/lib/home/superShowcase'
import { isFlagship } from '@/lib/offers/discoverTab'
import { roundedCount } from '@/lib/offers/raayonitPreview'
import { useOffers } from '@/lib/offers/useOffers'

// The eyebrow of the flagship Raayonit Card in place of the OfferTags line (native: landly-mobile/src/components/FlagshipEyebrow.tsx). The card is a
// multi-chain voucher, so it never wears the single category the legacy flagship document still carries, nor an "Online & in store" tag.
export default function FlagshipEyebrow({ className = '' }: { className?: string }) {
  const { t } = useLang()
  const { offers } = useOffers()
  const count = useMemo(() => roundedCount((offers ?? []).filter((o) => o.fulfillmentType === 'raayonit_pool' && !isFlagship(o)).length), [offers])
  return (
    <div className={`flex items-center gap-1.5 py-1 text-xs font-medium text-slate-600 ${className}`}>
      <Layers aria-hidden="true" className="h-3.5 w-3.5 shrink-0" strokeWidth={1.75} />
      <span className="min-w-0 truncate">{t('flagship_eyebrow').replace('{count}+', isolateLtr(`${count}+`))}</span>
    </div>
  )
}

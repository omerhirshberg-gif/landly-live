'use client'

import { useMemo } from 'react'
import { LANDING_COLUMN } from '@/components/landing/landingColumn'
import LiveDeals from '@/components/landing/LiveDeals'
import type { OfferDocument } from '@/lib/firebase/offers'
import { landlyOffers } from '@/lib/offers/discoverTab'

// The guest landing's live perks under the category photos: GoLandly's own server-cut deals only.
// Raayonit's "תו על" lives in its own tab (/raayonit); its flagship card has its own section above (GuestSuperShowcase). A guest opens any card
// freely; sign-in comes at the purchase bar.
export default function GuestDiscover({ deals }: { deals: OfferDocument[] }) {
  const landly = useMemo(() => landlyOffers(deals), [deals])
  if (landly.length === 0) return null
  return (
    <div className="pt-8 sm:pt-10">
      <div aria-hidden="true" className={`${LANDING_COLUMN} mb-6`}><div className="h-px w-full bg-slate-200" /></div>
      <LiveDeals deals={landly} />
    </div>
  )
}

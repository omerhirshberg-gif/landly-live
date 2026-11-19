'use client'

import { useMemo } from 'react'
import MultiChainShowcase from '@/components/discover/MultiChainShowcase'
import { LANDING_COLUMN } from '@/components/landing/landingColumn'
import { selectSuperVouchers } from '@/lib/home/categoryRails'
import { useOffers } from '@/lib/offers/useOffers'

// The flagship multi-chain vouchers on the guest landing, above the live deals: the same showcase /categories opens with. It needs
// the full offer (its voucher values), which the server-cut landing deals don't carry, so it reads the shared live list and
// renders nothing until a real multi-chain offer is on sale. A guest opens any card freely; sign-in comes at the purchase bar.
export default function GuestSuperShowcase() {
  const { offers } = useOffers()
  const superOffer = useMemo(() => (offers ? selectSuperVouchers(offers)[0] : undefined), [offers])
  if (!superOffer) return null
  return (
    <div className={`${LANDING_COLUMN} pt-8 sm:pt-10 lg:pt-12`}>
      <MultiChainShowcase offer={superOffer} />
    </div>
  )
}

'use client'

import Link from 'next/link'
import DashboardSectionCard from '@/components/business/DashboardSectionCard'
import OfferRow from '@/components/business/OfferRow'
import { useBusinessLang } from '@/lib/business/BusinessLangProvider'
import type { OfferStatus } from '@/lib/admin/offerStatus'

interface BusinessOffer {
  id: string
  title: string
  offerPrice: number
  totalQuantity: number | null
  claimedCount: number
  status: OfferStatus
}

const PREVIEW_CAP = 4

// Surfaces offers that are live right now regardless of purchases -- the
// voucher-stat tiles above are all purchase/redemption-based, so a freshly
// published offer with 0 claims would otherwise show up nowhere on the
// dashboard.
export default function LiveOffersPreview({
  offers,
  error,
}: {
  offers: BusinessOffer[] | null
  error: string | null
}) {
  const { t } = useBusinessLang()
  const liveOffers = offers?.filter((o) => o.status === 'active') ?? null

  return (
    <DashboardSectionCard
      title={t('bizdash_section_live_offers')}
      meta={
        liveOffers && liveOffers.length > PREVIEW_CAP ? (
          <Link href="/business/dashboard/offers" className="text-xs font-bold text-blue-400 hover:text-blue-300">
            {t('bizdash_view_all')}
          </Link>
        ) : undefined
      }
    >
      {error && <p className="text-sm font-semibold text-red-400">{error}</p>}
      {!error && liveOffers === null && <p className="text-slate-400 text-sm">{t('bizdash_loading')}</p>}
      {!error && liveOffers?.length === 0 && <p className="text-slate-500 text-sm">{t('bizdash_live_offers_empty')}</p>}

      {liveOffers && liveOffers.length > 0 && (
        <div className="space-y-2">
          {liveOffers.slice(0, PREVIEW_CAP).map((offer) => (
            <OfferRow key={offer.id} offer={offer} />
          ))}
        </div>
      )}
    </DashboardSectionCard>
  )
}

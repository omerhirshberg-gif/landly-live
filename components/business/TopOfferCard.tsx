'use client'

import DashboardSectionCard from '@/components/business/DashboardSectionCard'
import OfferRow from '@/components/business/OfferRow'
import { useBusinessLang } from '@/lib/business/BusinessLangProvider'

interface BusinessOffer {
  id: string
  title: string
  offerPrice: number
  totalQuantity: number | null
  claimedCount: number
}

export default function TopOfferCard({
  offers,
  error,
}: {
  offers: BusinessOffer[] | null
  error: string | null
}) {
  const { t } = useBusinessLang()
  const topOffer =
    offers && offers.length > 0 ? offers.reduce((best, o) => (o.claimedCount > best.claimedCount ? o : best), offers[0]) : null

  return (
    <DashboardSectionCard title={t('bizdash_section_top_offer')}>
      {error && <p className="text-sm font-semibold text-red-400">{error}</p>}
      {!error && offers === null && <p className="text-slate-400 text-sm">{t('bizdash_loading')}</p>}
      {!error && offers?.length === 0 && <p className="text-slate-500 text-sm">{t('bizdash_top_offer_empty')}</p>}
      {topOffer && <OfferRow offer={topOffer} />}
    </DashboardSectionCard>
  )
}

'use client'

import Navbar from '@/components/layout/Navbar'
import OfferListView from '@/components/discover/OfferListView'
import { useLang } from '@/lib/i18n/useLang'
import { getBestsellerOffers } from '@/lib/firebase/offers'

export default function BestsellerOffersPage() {
  const { t } = useLang()

  return (
    <>
      <Navbar />
      <div className="below-header member-canvas">
        <OfferListView emoji="🔥" title={t('row_bestsellers')} depKey="bestsellers" fetchOffers={getBestsellerOffers} />
      </div>
    </>
  )
}

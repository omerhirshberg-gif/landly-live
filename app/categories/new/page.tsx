'use client'

import Navbar from '@/components/layout/Navbar'
import OfferListView from '@/components/discover/OfferListView'
import { useLang } from '@/lib/i18n/useLang'
import { getAllOffers, isOfferNew } from '@/lib/firebase/offers'

export default function NewOffersPage() {
  const { t } = useLang()

  return (
    <>
      <Navbar />
      <div className="pt-16">
        <OfferListView
          emoji="✨"
          title={t('row_new')}
          depKey="new"
          fetchOffers={() => getAllOffers().then((offers) => offers.filter((offer) => isOfferNew(offer.createdAt)))}
        />
      </div>
    </>
  )
}

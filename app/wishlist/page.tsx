'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import Navbar from '@/components/layout/Navbar'
import OfferCard from '@/components/discover/OfferCard'
import { useLang } from '@/lib/i18n/useLang'
import { useAuth } from '@/lib/firebase/useAuth'
import { useWishlist } from '@/lib/firebase/useWishlist'
import { getOffersByIds, type OfferDocument } from '@/lib/firebase/offers'

export default function WishlistPage() {
  const { t } = useLang()
  const { user, loading } = useAuth()
  const router = useRouter()
  const { wishlistIds } = useWishlist()
  const [offers, setOffers] = useState<OfferDocument[] | undefined>(undefined)

  useEffect(() => {
    if (!loading && !user) router.replace('/login')
  }, [loading, user, router])

  useEffect(() => {
    if (!user) return
    let cancelled = false
    getOffersByIds(wishlistIds).then((result) => {
      if (!cancelled) setOffers(result)
    })
    return () => { cancelled = true }
  }, [user, wishlistIds])

  if (loading || !user) {
    return (
      <>
        <Navbar />
        <div className="pt-16 min-h-screen bg-slate-50" />
      </>
    )
  }

  return (
    <>
      <Navbar />
      <div className="pt-16 bg-slate-50 min-h-screen">
        <div className="max-w-3xl mx-auto px-5 sm:px-6 py-8 sm:py-10">
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 mb-6">{t('wishlist_title')}</h1>

          {offers === undefined ? (
            <div className="dash-empty-state">
              <i className="fa-solid fa-spinner fa-spin"></i>
            </div>
          ) : offers.length === 0 ? (
            <div className="dash-empty-state bg-white border border-slate-100 rounded-2xl">
              <i className="fa-solid fa-heart"></i>
              <div className="font-bold text-slate-700 text-base mb-1">{t('wishlist_empty_title')}</div>
              <p className="text-sm text-slate-500 max-w-xs mb-5">{t('wishlist_empty_sub')}</p>
              <Link href="/categories" className="tap-target btn-primary">
                <span>{t('nav_cta')}</span>
              </Link>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2.5 sm:gap-3">
              {offers.map((offer) => (
                <OfferCard key={offer.id} offer={offer} showWishlistButton />
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  )
}

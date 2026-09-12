'use client'

import { useEffect, useState } from 'react'
import BusinessProfileCard from '@/components/business/BusinessProfileCard'
import { useBusiness } from '@/components/business/BusinessGate'
import LiveOffersPreview from '@/components/business/LiveOffersPreview'
import RecentActivityList from '@/components/business/RecentActivityList'
import RedemptionTrendChart from '@/components/business/RedemptionTrendChart'
import TopOfferCard from '@/components/business/TopOfferCard'
import { useAuth } from '@/lib/firebase/useAuth'
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

interface RedeemedVoucher {
  id: string
  offerTitle: string
  redeemedAt: string | null
}

export default function BusinessDashboardPage() {
  const { t } = useBusinessLang()
  const { business } = useBusiness()
  const { user } = useAuth()

  const [offers, setOffers] = useState<BusinessOffer[] | null>(null)
  const [offersError, setOffersError] = useState<string | null>(null)
  const [redeemed, setRedeemed] = useState<RedeemedVoucher[] | null>(null)
  const [redeemedError, setRedeemedError] = useState<string | null>(null)

  useEffect(() => {
    if (!user) return
    let cancelled = false
    ;(async () => {
      try {
        const idToken = await user.getIdToken()
        const res = await fetch('/api/business/offers', { headers: { Authorization: `Bearer ${idToken}` } })
        const data = await res.json()
        if (cancelled) return
        if (!res.ok) {
          setOffersError(data.error ?? t('bizdash_offers_error'))
          return
        }
        setOffers(data.offers ?? [])
      } catch {
        if (!cancelled) setOffersError(t('bizdash_offers_error'))
      }
    })()
    return () => {
      cancelled = true
    }
  }, [user, t])

  useEffect(() => {
    if (!user) return
    let cancelled = false
    ;(async () => {
      try {
        const idToken = await user.getIdToken()
        const res = await fetch('/api/business/vouchers?status=redeemed', {
          headers: { Authorization: `Bearer ${idToken}` },
        })
        const data = await res.json()
        if (cancelled) return
        if (!res.ok) {
          setRedeemedError(data.error ?? t('bizdash_history_error'))
          return
        }
        setRedeemed(data.vouchers ?? [])
      } catch {
        if (!cancelled) setRedeemedError(t('bizdash_history_error'))
      }
    })()
    return () => {
      cancelled = true
    }
  }, [user, t])

  return (
    <div>
      <BusinessProfileCard />

      {/* Voucher stats */}
      <div className="grid grid-cols-3 gap-2.5 sm:gap-4 mb-5">
        <div className="dash-stat-card dash-stat-card-dark text-center min-w-0">
          <i className="fa-solid fa-gift text-blue-400 text-base sm:text-lg mb-1.5 sm:mb-2"></i>
          <div className="text-[10px] sm:text-xs text-slate-400 font-semibold leading-tight">{t('bizdash_stat_redeemed_month')}</div>
          <div className="text-xs sm:text-base font-black text-white">{business.voucherStats.redeemedThisMonth}</div>
        </div>
        <div className="dash-stat-card dash-stat-card-dark text-center min-w-0">
          <i className="fa-solid fa-clock-rotate-left text-cyan-400 text-base sm:text-lg mb-1.5 sm:mb-2"></i>
          <div className="text-[10px] sm:text-xs text-slate-400 font-semibold leading-tight">{t('bizdash_stat_redeemed_total')}</div>
          <div className="text-xs sm:text-base font-black text-white">{business.voucherStats.redeemedTotal}</div>
        </div>
        <div className="dash-stat-card dash-stat-card-dark text-center min-w-0">
          <i className="fa-solid fa-tags text-emerald-400 text-base sm:text-lg mb-1.5 sm:mb-2"></i>
          <div className="text-[10px] sm:text-xs text-slate-400 font-semibold leading-tight">{t('bizdash_stat_active')}</div>
          <div className="text-xs sm:text-base font-black text-white">{business.voucherStats.active}</div>
        </div>
      </div>

      {/* Symmetric 2-column grid -- every card the same width, no stacked
          columns of mismatched heights. */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <LiveOffersPreview offers={offers} error={offersError} />
        <TopOfferCard offers={offers} error={offersError} />
        <RedemptionTrendChart vouchers={redeemed} error={redeemedError} />
        <RecentActivityList vouchers={redeemed} error={redeemedError} />
      </div>
    </div>
  )
}

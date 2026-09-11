'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { signOut } from 'firebase/auth'
import BusinessHeader from '@/components/business/BusinessHeader'
import { useLang } from '@/lib/i18n/useLang'
import { useAuth } from '@/lib/firebase/useAuth'
import { auth } from '@/lib/firebase/config'
import { getBusinessDocument, BusinessDocument } from '@/lib/firebase/businesses'

export default function BusinessDashboardPage() {
  const { t } = useLang()
  const { user, loading } = useAuth()
  const router = useRouter()
  const [business, setBusiness] = useState<BusinessDocument | null>(null)
  const [checkingBusiness, setCheckingBusiness] = useState(true)

  useEffect(() => {
    if (!loading && !user) router.replace('/business/login')
  }, [loading, user, router])

  useEffect(() => {
    if (!user) return
    let cancelled = false
    getBusinessDocument(user.uid).then(async (doc) => {
      if (cancelled) return
      if (!doc) {
        await signOut(auth)
        router.replace('/business/login')
        return
      }
      setBusiness(doc)
      setCheckingBusiness(false)
    })
    return () => { cancelled = true }
  }, [user, router])

  if (loading || !user || checkingBusiness || !business) {
    return (
      <>
        <BusinessHeader businessName="" />
        <div className="pt-16 min-h-screen bg-slate-950" />
      </>
    )
  }

  return (
    <>
      <BusinessHeader businessName={business.businessName} />
      <div className="pt-16 bg-slate-950 min-h-screen">
        <div className="max-w-3xl mx-auto px-5 sm:px-6 py-8 sm:py-10">

          <div className="mb-6">
            <div className="text-xs font-bold tracking-widest text-blue-400 uppercase mb-1">{t('bizdash_label')}</div>
            <h1 className="text-2xl sm:text-3xl font-black text-white">{business.businessName}</h1>
            <div className="flex flex-wrap items-center gap-2 mt-2.5 text-sm text-slate-400 font-semibold">
              <span className="segment-badge" style={{ background: '#0038b8' }}>{business.category}</span>
              <span>{t('bizdash_id_label')}: {business.businessId}</span>
              {business.location && <span>· {business.location}</span>}
            </div>
          </div>

          {/* Voucher stats */}
          <div className="grid grid-cols-3 gap-2.5 sm:gap-4 mb-5">
            <div className="dash-stat-card dash-stat-card-dark text-center">
              <i className="fa-solid fa-gift text-blue-400 text-base sm:text-lg mb-1.5 sm:mb-2"></i>
              <div className="text-[10px] sm:text-xs text-slate-400 font-semibold leading-tight">{t('bizdash_stat_redeemed_month')}</div>
              <div className="text-xs sm:text-base font-black text-white">{business.voucherStats.redeemedThisMonth}</div>
            </div>
            <div className="dash-stat-card dash-stat-card-dark text-center">
              <i className="fa-solid fa-clock-rotate-left text-cyan-400 text-base sm:text-lg mb-1.5 sm:mb-2"></i>
              <div className="text-[10px] sm:text-xs text-slate-400 font-semibold leading-tight">{t('bizdash_stat_redeemed_total')}</div>
              <div className="text-xs sm:text-base font-black text-white">{business.voucherStats.redeemedTotal}</div>
            </div>
            <div className="dash-stat-card dash-stat-card-dark text-center">
              <i className="fa-solid fa-tags text-emerald-400 text-base sm:text-lg mb-1.5 sm:mb-2"></i>
              <div className="text-[10px] sm:text-xs text-slate-400 font-semibold leading-tight">{t('bizdash_stat_active')}</div>
              <div className="text-xs sm:text-base font-black text-white">{business.voucherStats.active}</div>
            </div>
          </div>

          {/* Coming soon: voucher approval */}
          <div className="bg-amber-950/30 border border-dashed border-amber-800 rounded-2xl p-5 flex items-start gap-3">
            <i className="fa-solid fa-qrcode text-amber-400 text-xl flex-shrink-0 mt-0.5"></i>
            <div>
              <div className="font-bold text-amber-300 mb-1">{t('bizdash_comingsoon_title')}</div>
              <p className="text-sm text-amber-200/80">{t('bizdash_comingsoon_desc')}</p>
            </div>
          </div>

        </div>
      </div>
    </>
  )
}

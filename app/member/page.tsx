'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import Navbar from '@/components/layout/Navbar'
import { useLang } from '@/lib/i18n/useLang'
import { useAuth } from '@/lib/firebase/useAuth'

export default function MemberPage() {
  const { t } = useLang()
  const { user, loading } = useAuth()
  const router = useRouter()
  const [plan, setPlan] = useState<'monthly' | 'annual'>('annual')
  const [toast, setToast] = useState<string | null>(null)
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!loading && !user) router.replace('/login')
  }, [loading, user, router])

  const showToast = (message: string) => {
    setToast(message)
    if (toastTimer.current) clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(null), 2600)
  }

  useEffect(() => () => { if (toastTimer.current) clearTimeout(toastTimer.current) }, [])

  const switchPlan = (next: 'monthly' | 'annual') => {
    if (next === plan) return
    setPlan(next)
    showToast(next === 'monthly' ? t('toast_plan_monthly') : t('toast_plan_annual'))
  }

  const showSegmentInfo = () => showToast(t('dash_segment_toast'))

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
      <div className="pt-16 bg-slate-50">
        <div className="max-w-3xl mx-auto px-5 sm:px-6 py-8 sm:py-10">

          <div className="flex items-start justify-between mb-6 gap-3">
            <div>
              <div className="text-xs font-bold tracking-widest text-brand uppercase mb-1">{t('dash_label')}</div>
              <h1 className="text-2xl sm:text-3xl font-black text-slate-900">{t('dash_welcome')}</h1>
              <div className="flex flex-wrap items-center gap-2 mt-2.5">
                <span className="segment-badge">
                  <i className="fa-solid fa-passport"></i>
                  <span>{t('dash_segment_value')}</span>
                </span>
                <button onClick={showSegmentInfo} className="segment-hint">
                  <span>{t('dash_segment_hint')}</span>
                  <i className="fa-solid fa-chevron-down text-[9px]"></i>
                </button>
              </div>
            </div>
            <Link href="/" className="tap-target hidden sm:flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-red-600 transition flex-shrink-0">
              <i className="fa-solid fa-arrow-right-from-bracket"></i> <span>{t('dash_back_public')}</span>
            </Link>
          </div>

          {/* Membership status */}
          <div className="bg-brand text-white rounded-2xl p-5 sm:p-6 mb-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <div className="text-blue-200 text-sm font-semibold mb-1">{t('perks_active_membership')}</div>
              <div className="text-xl sm:text-2xl font-black">{plan === 'monthly' ? t('plan_monthly_name') : t('plan_annual_name')}</div>
              <div className="text-blue-200 text-sm mt-1"><span>{t('perks_renews')}</span> January 2026</div>
            </div>
            <div className="text-left sm:text-right">
              <div className="text-blue-200 text-xs mb-1">{t('dash_total_saved')}</div>
              <div className="text-2xl sm:text-3xl font-black" dir="ltr">₪1,240</div>
            </div>
          </div>

          {/* Snapshot stats: Card status / Savings / Raffle entries */}
          <div className="grid grid-cols-3 gap-2.5 sm:gap-4 mb-5">
            <div className="dash-stat-card text-center">
              <i className="fa-solid fa-credit-card text-brand text-base sm:text-lg mb-1.5 sm:mb-2"></i>
              <div className="text-[10px] sm:text-xs text-slate-500 font-semibold leading-tight">{t('dash_card_status_label')}</div>
              <div className="text-xs sm:text-base font-black text-slate-900">{t('dash_card_status_value')}</div>
            </div>
            <div className="dash-stat-card text-center">
              <i className="fa-solid fa-sack-dollar text-emerald-600 text-base sm:text-lg mb-1.5 sm:mb-2"></i>
              <div className="text-[10px] sm:text-xs text-slate-500 font-semibold leading-tight">{t('dash_total_saved')}</div>
              <div className="text-xs sm:text-base font-black text-slate-900" dir="ltr">₪1,240</div>
            </div>
            <div className="dash-stat-card text-center">
              <i className="fa-solid fa-ticket text-amber-500 text-base sm:text-lg mb-1.5 sm:mb-2"></i>
              <div className="text-[10px] sm:text-xs text-slate-500 font-semibold leading-tight">{t('dash_raffle_entries_label')}</div>
              <div className="text-xs sm:text-base font-black text-slate-900">{t('dash_raffle_entries_value')}</div>
            </div>
          </div>

          {/* Raffle note */}
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 mb-8 flex items-center gap-3">
            <i className="fa-solid fa-champagne-glasses text-amber-500 text-xl flex-shrink-0"></i>
            <p className="text-sm text-amber-800"><strong>{t('perks_raffle_entered')}</strong> <span>{t('perks_raffle_note')}</span></p>
          </div>

          {/* Active vouchers */}
          <h2 className="text-lg font-bold text-slate-900 mb-4">{t('perks_unredeemed')}</h2>
          <div className="space-y-4 mb-4">
            <div className="bg-white border border-slate-100 rounded-2xl p-4 sm:p-5 flex items-center gap-4 sm:gap-5 shadow-sm">
              <div className="qr-box"></div>
              <div className="flex-1 min-w-0">
                <div className="font-bold text-slate-900 text-sm sm:text-base">Pasta Nostra 20% Off</div>
                <div className="text-xs sm:text-sm text-slate-500 mt-1">TLV, Rothschild Boulevard</div>
                <div className="text-xs text-red-500 mt-2 font-semibold"><span>{t('perks_expires')}</span> March 31, 2025</div>
              </div>
              <button className="tap-target bg-brand text-white text-xs font-bold px-3 sm:px-4 py-2 rounded-full flex-shrink-0 shadow">{t('perks_show_qr')}</button>
            </div>
            <div className="bg-white border border-slate-100 rounded-2xl p-4 sm:p-5 flex items-center gap-4 sm:gap-5 shadow-sm">
              <div className="qr-box"></div>
              <div className="flex-1 min-w-0">
                <div className="font-bold text-slate-900 text-sm sm:text-base">Holmes Place 30% Off</div>
                <div className="text-xs sm:text-sm text-slate-500 mt-1">Multiple locations</div>
                <div className="text-xs text-orange-500 mt-2 font-semibold"><span>{t('perks_expires')}</span> April 15, 2025</div>
              </div>
              <button className="tap-target bg-brand text-white text-xs font-bold px-3 sm:px-4 py-2 rounded-full flex-shrink-0 shadow">{t('perks_show_qr')}</button>
            </div>
            <div className="bg-white border border-slate-100 rounded-2xl p-4 sm:p-5 flex items-center gap-4 sm:gap-5 shadow-sm">
              <div className="qr-box"></div>
              <div className="flex-1 min-w-0">
                <div className="font-bold text-slate-900 text-sm sm:text-base">Surf Club Israel 20% Off</div>
                <div className="text-xs sm:text-sm text-slate-500 mt-1">Hilton Beach</div>
                <div className="text-xs text-emerald-600 mt-2 font-semibold"><span>{t('perks_expires')}</span> June 30, 2025</div>
              </div>
              <button className="tap-target bg-brand text-white text-xs font-bold px-3 sm:px-4 py-2 rounded-full flex-shrink-0 shadow">{t('perks_show_qr')}</button>
            </div>
          </div>
          <div className="text-center mb-4">
            <Link href="/#deals" className="tap-target inline-flex items-center gap-2 bg-brand text-white font-bold px-8 py-3 rounded-full hover:bg-brandDark transition shadow-md">
              <i className="fa-solid fa-plus"></i> <span>{t('perks_browse_more')}</span>
            </Link>
          </div>

          {/* Account / Plan management — bottom section */}
          <div className="mt-10 pt-8 border-t border-slate-200">
            <h2 className="text-lg font-bold text-slate-900 mb-1">{t('dash_plan_mgmt')}</h2>
            <p className="text-sm text-slate-500 mb-5">{t('dash_plan_mgmt_sub')}</p>
            <div className="grid sm:grid-cols-2 gap-4">
              <div className={`dash-plan-card ${plan === 'monthly' ? 'dash-plan-active' : ''}`}>
                <div className="flex items-center justify-between mb-2">
                  <span className="font-bold text-slate-900">{t('plan_monthly_name')}</span>
                  <span className="text-brand font-black text-lg">39 <span className="text-xs font-medium text-slate-400">{t('price_suffix')}</span></span>
                </div>
                <p className="text-xs text-slate-500 mb-4">{t('plan_monthly_note')}</p>
                {plan === 'monthly' ? (
                  <button className="tap-target w-full text-center justify-center bg-brand text-white font-bold py-2.5 rounded-full text-sm cursor-default">{t('dash_current_plan')}</button>
                ) : (
                  <button onClick={() => switchPlan('monthly')} className="tap-target w-full text-center justify-center border-2 border-brand text-brand font-bold py-2.5 rounded-full hover:bg-brandLight transition text-sm">{t('dash_switch_btn')}</button>
                )}
              </div>
              <div className={`dash-plan-card ${plan === 'annual' ? 'dash-plan-active' : ''}`}>
                <div className="flex items-center justify-between mb-2">
                  <span className="font-bold text-slate-900">{t('plan_annual_name')}</span>
                  <span className="text-brand font-black text-lg">29 <span className="text-xs font-medium text-slate-400">{t('price_suffix')}</span></span>
                </div>
                <p className="text-xs text-slate-500 mb-4">{t('plan_annual_note1')}</p>
                {plan === 'annual' ? (
                  <button className="tap-target w-full text-center justify-center bg-brand text-white font-bold py-2.5 rounded-full text-sm cursor-default">{t('dash_current_plan')}</button>
                ) : (
                  <button onClick={() => switchPlan('annual')} className="tap-target w-full text-center justify-center border-2 border-brand text-brand font-bold py-2.5 rounded-full hover:bg-brandLight transition text-sm">{t('dash_switch_btn')}</button>
                )}
              </div>
            </div>
          </div>

          <div className="mt-10 text-center sm:hidden">
            <Link href="/" className="tap-target inline-flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-red-600 transition">
              <i className="fa-solid fa-arrow-right-from-bracket"></i> <span>{t('dash_back_public')}</span>
            </Link>
          </div>
        </div>
      </div>

      <div className={`toast-msg ${toast ? 'show' : ''}`}>{toast}</div>
    </>
  )
}

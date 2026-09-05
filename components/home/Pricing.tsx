'use client'

import { useEffect, useState } from 'react'
import type { User } from 'firebase/auth'
import { useLang } from '@/lib/i18n/useLang'
import { getUserDocument, SubscriptionStatus } from '@/lib/firebase/users'

export default function Pricing({ onOpenTerms, user }: { onOpenTerms: () => void; user?: User }) {
  const { t } = useLang()
  const [showComingSoon, setShowComingSoon] = useState(false)
  const [subscriptionStatus, setSubscriptionStatus] = useState<SubscriptionStatus | null>(null)

  useEffect(() => {
    if (!user) return
    let cancelled = false
    getUserDocument(user.uid).then((doc) => {
      if (!cancelled) setSubscriptionStatus(doc?.subscriptionStatus ?? 'inactive')
    })
    return () => { cancelled = true }
  }, [user])

  return (
    <section id="pricing" className="py-14 sm:py-20 bg-slate-50">
      <div className="max-w-7xl mx-auto px-5 sm:px-6">
        <div className="text-xs font-bold tracking-widest text-brand uppercase mb-3">{t('pricing_label')}</div>
        <h2 className="text-3xl sm:text-4xl font-black text-slate-900 mb-10 sm:mb-12" style={{ letterSpacing: '-1px' }}>{t('pricing_title')}</h2>
        {user && subscriptionStatus && (
          <div className="max-w-4xl mb-6 sm:mb-8 flex items-center gap-2.5 text-sm font-semibold text-slate-700 bg-white border border-slate-200 rounded-xl px-4 py-3">
            <i className="fa-solid fa-circle-check text-brand flex-shrink-0"></i>
            <span>{t('pricing_current_status_label')}</span>
            <span className="text-slate-500 font-normal">{t('sub_status_message')}</span>
          </div>
        )}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 sm:gap-6 max-w-4xl items-stretch">
          <div className="flex flex-col bg-white border-2 border-slate-100 rounded-2xl p-7 sm:p-8 hover:border-brand transition hover:shadow-lg">
            <div className="text-sm font-bold text-slate-400 mb-2">{t('plan_monthly_name')}</div>
            <div className="text-2xl sm:text-3xl font-black text-brand mb-1">{t('price_coming_soon')}</div>
            <div className="text-xs text-slate-400 mb-6">{t('plan_monthly_note')}</div>
            <ul className="space-y-3 mb-8 text-sm text-slate-600">
              <li className="flex gap-2 items-start"><i className="fa-solid fa-check text-brand mt-0.5 flex-shrink-0"></i><span>{t('feat_all_discounts')}</span></li>
              <li className="flex gap-2 items-start"><i className="fa-solid fa-check text-brand mt-0.5 flex-shrink-0"></i><span>{t('feat_legal')}</span></li>
              <li className="flex gap-2 items-start"><i className="fa-solid fa-check text-brand mt-0.5 flex-shrink-0"></i><span>{t('feat_raffle')}</span></li>
            </ul>
            <button onClick={() => setShowComingSoon(true)} className="tap-target block w-full text-center bg-brandLight text-brand font-bold py-3 rounded-full hover:bg-blue-100 transition mt-auto">{t('btn_get_started')}</button>
          </div>
          <div className="flex flex-col bg-white border-2 border-slate-100 rounded-2xl p-7 sm:p-8 hover:border-brand transition hover:shadow-lg">
            <div className="text-sm font-bold text-slate-400 mb-2">{t('plan_quarterly_name')}</div>
            <div className="text-2xl sm:text-3xl font-black text-brand mb-1">{t('price_coming_soon')}</div>
            <div className="text-xs text-slate-400 mb-6">{t('plan_quarterly_note')}</div>
            <ul className="space-y-3 mb-8 text-sm text-slate-600">
              <li className="flex gap-2 items-start"><i className="fa-solid fa-check text-brand mt-0.5 flex-shrink-0"></i><span>{t('feat_everything_monthly')}</span></li>
              <li className="flex gap-2 items-start"><i className="fa-solid fa-check text-brand mt-0.5 flex-shrink-0"></i><span>{t('feat_legal')}</span></li>
              <li className="flex gap-2 items-start"><i className="fa-solid fa-check text-brand mt-0.5 flex-shrink-0"></i><span>{t('feat_community')}</span></li>
              <li className="flex gap-2 items-start"><i className="fa-solid fa-check text-brand mt-0.5 flex-shrink-0"></i><span>{t('feat_raffle')}</span></li>
            </ul>
            <button onClick={() => setShowComingSoon(true)} className="tap-target block w-full text-center bg-brandLight text-brand font-bold py-3 rounded-full hover:bg-blue-100 transition mt-auto">{t('btn_get_started')}</button>
          </div>
          <div className="flex flex-col bg-white border-2 border-brand rounded-2xl p-7 sm:p-8 relative shadow-xl shadow-blue-100">
            <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-amber-400 text-amber-900 text-[11px] font-bold px-4 py-1 rounded-full whitespace-nowrap">{t('best_value')}</div>
            <div className="text-sm font-bold text-slate-400 mb-2">{t('plan_annual_name')}</div>
            <div className="text-2xl sm:text-3xl font-black text-brand mb-1">{t('price_coming_soon')}</div>
            <div className="text-xs text-slate-400 mb-6">{t('plan_annual_note2')}</div>
            <ul className="space-y-3 mb-8 text-sm text-slate-600">
              <li className="flex gap-2 items-start"><i className="fa-solid fa-check text-brand mt-0.5 flex-shrink-0"></i><span>{t('feat_everything_quarterly')}</span></li>
              <li className="flex gap-2 items-start"><i className="fa-solid fa-check text-brand mt-0.5 flex-shrink-0"></i><span>{t('feat_priority_matching')}</span></li>
              <li className="flex gap-2 items-start"><i className="fa-solid fa-check text-brand mt-0.5 flex-shrink-0"></i><span>{t('feat_vip')}</span></li>
              <li className="flex gap-2 items-start"><i className="fa-solid fa-check text-brand mt-0.5 flex-shrink-0"></i><span>{t('feat_whatsapp')}</span></li>
              <li className="flex gap-2 items-start"><i className="fa-solid fa-check text-brand mt-0.5 flex-shrink-0"></i><span>{t('feat_priority_raffle')}</span></li>
            </ul>
            <button onClick={() => setShowComingSoon(true)} className="tap-target block w-full text-center bg-brand text-white font-bold py-3 rounded-full hover:bg-brandDark transition shadow-md mt-auto">{t('btn_get_annual')}</button>
          </div>
        </div>

        {showComingSoon && (
          <div className="max-w-4xl mt-5 text-sm font-semibold text-brand bg-brandLight border border-blue-200 rounded-xl px-4 py-3 flex items-center justify-between gap-3">
            <span className="flex items-center gap-2"><i className="fa-solid fa-circle-info flex-shrink-0"></i>{t('pricing_coming_soon_msg')}</span>
            <button onClick={() => setShowComingSoon(false)} aria-label="Dismiss" className="tap-target text-brand/70 hover:text-brand flex-shrink-0"><i className="fa-solid fa-xmark"></i></button>
          </div>
        )}

        <p className="text-slate-400 text-xs mt-5"><span>{t('pricing_disclaimer_pre')}</span> <button onClick={onOpenTerms} className="text-brand underline font-semibold">{t('terms_link')}</button><span>{t('pricing_disclaimer_post')}</span></p>
      </div>
    </section>
  )
}

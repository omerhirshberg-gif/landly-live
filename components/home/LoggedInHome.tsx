'use client'

import Link from 'next/link'
import type { User } from 'firebase/auth'
import { useLang } from '@/lib/i18n/useLang'

// No vouchers/redemptions collection exists in Firestore yet (see firestore.rules) —
// show the honest zero until real voucher data is wired up.
const ACTIVE_VOUCHER_COUNT = 0

export default function LoggedInHome({ user }: { user: User }) {
  const { t } = useLang()
  const displayName = user.displayName?.trim() || user.email?.split('@')[0] || ''
  const initial = (displayName.charAt(0) || '?').toUpperCase()

  return (
    <div className="pt-16 bg-slate-50 min-h-screen">
      <div className="max-w-3xl mx-auto px-5 sm:px-6 py-10 sm:py-14">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-12 h-12 rounded-full bg-brand text-white flex items-center justify-center font-black text-lg flex-shrink-0">
            {initial}
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900">
            {t('home_greeting').replace('{name}', displayName)}
          </h1>
        </div>

        <div className="grid sm:grid-cols-2 gap-4 sm:gap-5">
          <div className="bg-white border border-slate-100 rounded-2xl p-5 sm:p-6 shadow-sm flex flex-col">
            <i className="fa-solid fa-gift text-brand text-xl mb-3"></i>
            <p className="text-sm text-slate-700 leading-relaxed mb-4 flex-1">
              {t('home_vouchers_message').replace('{count}', String(ACTIVE_VOUCHER_COUNT))}
            </p>
            <Link href="/member" className="tap-target btn-primary text-center justify-center">
              {t('home_vouchers_cta')}
            </Link>
          </div>

          <div className="bg-brand rounded-2xl p-5 sm:p-6 shadow-sm flex flex-col text-white">
            <i className="fa-solid fa-compass text-xl mb-3"></i>
            <div className="font-bold text-base mb-1">{t('home_discover_title')}</div>
            <p className="text-blue-200 text-sm leading-relaxed mb-4 flex-1">{t('home_discover_sub')}</p>
            <Link
              href="/categories"
              className="tap-target inline-flex items-center justify-center gap-2 bg-white text-brand font-bold text-sm px-5 py-2.5 rounded-full hover:bg-brandLight transition"
            >
              <span>{t('home_discover_cta')}</span>
              <i className="fa-solid fa-arrow-right text-xs"></i>
            </Link>
          </div>
        </div>

        <div className="bg-white border border-slate-100 rounded-2xl p-5 sm:p-6 shadow-sm mt-4 sm:mt-5">
          <i className="fa-solid fa-sparkles text-brand text-xl mb-3"></i>
          <div className="font-bold text-base text-slate-900 mb-1">{t('home_recommended_title')}</div>
          <p className="text-sm text-slate-500 leading-relaxed">{t('home_recommended_message')}</p>
        </div>
      </div>
    </div>
  )
}

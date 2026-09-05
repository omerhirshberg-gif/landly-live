'use client'

import { Suspense, useEffect } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import Navbar from '@/components/layout/Navbar'
import { useLang } from '@/lib/i18n/useLang'
import { useAuth } from '@/lib/firebase/useAuth'
import { Lang } from '@/lib/i18n/translations'
import { isValidPlanId, PLANS, formatPrice } from '@/lib/plans'

const DATE_LOCALE: Record<Lang, string> = {
  en: 'en-US',
  ru: 'ru-RU',
  es: 'es-ES',
  fr: 'fr-FR',
  he: 'he-IL',
}

// Renders only from URL search params — orderId, plan, amount, expiresAt — so
// this page never carries hardcoded/fake order data. Nothing in the real
// checkout flow links here yet (payment isn't wired up); see
// app/dev/checkout-success-preview for a way to preview it with mock params.
function CheckoutSuccessContent() {
  const { t, lang } = useLang()
  const { user, loading } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()

  const orderId = searchParams.get('orderId')
  const planParam = searchParams.get('plan')
  const amountParam = searchParams.get('amount')
  const expiresAtParam = searchParams.get('expiresAt')

  const plan = isValidPlanId(planParam) ? PLANS[planParam] : null
  const amount = amountParam ? Number(amountParam) : null
  const expiresAt = expiresAtParam ? new Date(expiresAtParam) : null
  const isValidOrder = !!orderId && !!plan && amount !== null && !Number.isNaN(amount) && !!expiresAt && !Number.isNaN(expiresAt.getTime())

  useEffect(() => {
    if (!loading && !user) router.replace('/login')
  }, [loading, user, router])

  useEffect(() => {
    if (!loading && user && !isValidOrder) router.replace('/member')
  }, [loading, user, isValidOrder, router])

  if (loading || !user || !isValidOrder || !plan || amount === null || !expiresAt) {
    return (
      <>
        <Navbar />
        <div className="pt-16 min-h-screen bg-slate-50" />
      </>
    )
  }

  const formattedExpiry = new Intl.DateTimeFormat(DATE_LOCALE[lang], { year: 'numeric', month: 'long', day: 'numeric' }).format(expiresAt)

  return (
    <>
      <Navbar />
      <div className="pt-16 bg-slate-50 min-h-screen">
        <div className="max-w-lg mx-auto px-5 sm:px-6 py-8 sm:py-10">
          <div className="bg-white border border-slate-100 rounded-2xl p-6 sm:p-8 shadow-sm text-center">
            <div className="success-checkmark">
              <i className="fa-solid fa-check"></i>
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 mb-1">{t('success_title')}</h1>
            <p className="text-sm text-slate-500 mb-6">{t('success_subtitle')}</p>

            <div className="text-start border-t border-slate-100 pt-5 space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-500">{t('success_order_number_label')}</span>
                <span className="font-bold text-slate-900" dir="ltr">{orderId}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-500">{t('sub_plan_label')}</span>
                <span className="font-bold text-slate-900">{t(plan.nameKey)}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-500">{t('success_amount_paid_label')}</span>
                <span className="font-bold text-slate-900" dir="ltr">{formatPrice(amount, plan.currency)}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-500">{t('success_plan_expires_label')}</span>
                <span className="font-bold text-slate-900">{formattedExpiry}</span>
              </div>
            </div>

            <Link href="/member" className="tap-target block w-full text-center bg-brand text-white font-bold py-3 rounded-full hover:bg-brandDark transition shadow-md mt-6">
              {t('success_back_to_account')}
            </Link>
          </div>
        </div>
      </div>
    </>
  )
}

export default function CheckoutSuccessPage() {
  return (
    <Suspense fallback={null}>
      <CheckoutSuccessContent />
    </Suspense>
  )
}

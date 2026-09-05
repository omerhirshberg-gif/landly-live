'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Navbar from '@/components/layout/Navbar'
import TranzilaPaymentWidget from '@/components/checkout/TranzilaPaymentWidget'
import { useLang } from '@/lib/i18n/useLang'
import { useAuth } from '@/lib/firebase/useAuth'
import { PLANS, getPlanDiscount, formatPrice, isValidPlanId } from '@/lib/plans'

type CheckoutStep = 'summary' | 'payment'

function CheckoutContent() {
  const { t } = useLang()
  const { user, loading } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [step, setStep] = useState<CheckoutStep>('summary')

  const planParam = searchParams.get('plan')
  const plan = isValidPlanId(planParam) ? PLANS[planParam] : null

  useEffect(() => {
    if (!loading && !user) router.replace('/login')
  }, [loading, user, router])

  useEffect(() => {
    if (!plan) router.replace('/#pricing')
  }, [plan, router])

  if (loading || !user || !plan) {
    return (
      <>
        <Navbar />
        <div className="pt-16 min-h-screen bg-slate-50" />
      </>
    )
  }

  const discount = getPlanDiscount(plan)
  const total = plan.basePrice

  return (
    <>
      <Navbar />
      <div className="pt-16 bg-slate-50 min-h-screen">
        <div className="max-w-lg mx-auto px-5 sm:px-6 py-8 sm:py-10">
          <div className="text-xs font-bold tracking-widest text-brand uppercase mb-1">{t('checkout_label')}</div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 mb-6">{t('checkout_title')}</h1>

          {step === 'summary' && (
            <div className="bg-white border border-slate-100 rounded-2xl p-6 sm:p-8 shadow-sm">
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-semibold text-slate-500">{t('sub_plan_label')}</span>
                <span className="text-sm font-bold text-slate-900">{t(plan.nameKey)}</span>
              </div>
              <div className="text-xs text-slate-400 mb-5">{t(plan.noteKey)}</div>

              <div className="border-t border-slate-100 pt-5 space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-500">{t('checkout_base_price_label')}</span>
                  <span className="font-semibold text-slate-900" dir="ltr">{formatPrice(discount ? plan.monthlyEquivalent * plan.billingMonths : plan.basePrice, plan.currency)}</span>
                </div>
                {discount && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-emerald-600 font-semibold">{t('checkout_discount_label')}</span>
                    <span className="text-emerald-600 font-semibold" dir="ltr">-{formatPrice(discount.amount, plan.currency)}</span>
                  </div>
                )}
              </div>

              <div className="border-t border-slate-100 mt-4 pt-4 flex items-center justify-between">
                <span className="text-base font-bold text-slate-900">{t('checkout_total_label')}</span>
                <span className="text-xl font-black text-brand" dir="ltr">{formatPrice(total, plan.currency)}</span>
              </div>

              {discount && (
                <div className="mt-4 text-xs font-semibold text-emerald-600 bg-emerald-50 border border-emerald-100 rounded-xl px-3 py-2">
                  {t('checkout_savings_note').replace('{percent}', String(discount.percent))}
                </div>
              )}

              <button
                onClick={() => setStep('payment')}
                className="tap-target block w-full text-center bg-brand text-white font-bold py-3 rounded-full hover:bg-brandDark transition shadow-md mt-6"
              >
                {t('checkout_pay_button')}
              </button>
            </div>
          )}

          {step === 'payment' && (
            <TranzilaPaymentWidget plan={plan} amount={total} onBack={() => setStep('summary')} />
          )}
        </div>
      </div>
    </>
  )
}

export default function CheckoutPage() {
  return (
    <Suspense fallback={null}>
      <CheckoutContent />
    </Suspense>
  )
}

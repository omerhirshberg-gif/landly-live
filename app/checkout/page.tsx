'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Navbar from '@/components/layout/Navbar'
import TranzilaPaymentWidget from '@/components/checkout/TranzilaPaymentWidget'
import { useLang } from '@/lib/i18n/useLang'
import { useAuth } from '@/lib/firebase/useAuth'
import { formatPrice } from '@/lib/format'

type CheckoutStep = 'summary' | 'payment'

interface OrderSummary {
  orderId: string
  amount: number
  offerTitle: string
  businessName: string
}

function CheckoutContent() {
  const { t } = useLang()
  const { user, loading } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [step, setStep] = useState<CheckoutStep>('summary')
  const [order, setOrder] = useState<OrderSummary | null>(null)
  const [error, setError] = useState<string | null>(null)

  const offerId = searchParams.get('offerId')

  useEffect(() => {
    if (!loading && !user) router.replace('/login')
  }, [loading, user, router])

  useEffect(() => {
    if (!offerId) {
      router.replace('/categories')
      return
    }
    if (!user) return

    let cancelled = false
    ;(async () => {
      try {
        const idToken = await user.getIdToken()
        const res = await fetch('/api/payments/initiate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
          body: JSON.stringify({ offerId }),
        })
        const data = await res.json()
        if (cancelled) return
        if (!res.ok) {
          setError(data.error ?? t('checkout_error_generic'))
          return
        }
        setOrder({ orderId: data.orderId, amount: data.amount, offerTitle: data.offerTitle, businessName: data.businessName })
      } catch {
        if (!cancelled) setError(t('checkout_error_generic'))
      }
    })()
    return () => { cancelled = true }
  }, [user, offerId, router, t])

  if (loading || !user || (!order && !error)) {
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
        <div className="max-w-lg mx-auto px-5 sm:px-6 py-8 sm:py-10">
          <div className="text-xs font-bold tracking-widest text-brand uppercase mb-1">{t('checkout_label')}</div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 mb-6">{t('checkout_title')}</h1>

          {error && !order && (
            <div className="bg-white border border-slate-100 rounded-2xl p-6 sm:p-8 shadow-sm text-center">
              <i className="fa-solid fa-circle-exclamation text-red-500 text-2xl mb-3"></i>
              <p className="text-sm text-slate-600">{error}</p>
            </div>
          )}

          {order && step === 'summary' && (
            <div className="bg-white border border-slate-100 rounded-2xl p-6 sm:p-8 shadow-sm">
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-semibold text-slate-500">{t('checkout_offer_label')}</span>
                <span className="text-sm font-bold text-slate-900">{order.offerTitle}</span>
              </div>
              <div className="text-xs text-slate-400 mb-5">{order.businessName}</div>

              <div className="border-t border-slate-100 pt-5 flex items-center justify-between">
                <span className="text-base font-bold text-slate-900">{t('checkout_total_label')}</span>
                <span className="text-xl font-black text-brand" dir="ltr">{formatPrice(order.amount)}</span>
              </div>

              <button
                onClick={() => setStep('payment')}
                className="tap-target block w-full text-center bg-brand text-white font-bold py-3 rounded-full hover:bg-brandDark transition shadow-md mt-6"
              >
                {t('checkout_pay_button')}
              </button>
            </div>
          )}

          {order && step === 'payment' && (
            <TranzilaPaymentWidget offerTitle={order.offerTitle} amount={order.amount} onBack={() => setStep('summary')} />
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

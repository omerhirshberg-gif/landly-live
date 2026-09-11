'use client'

import { Suspense, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import Navbar from '@/components/layout/Navbar'
import { useLang } from '@/lib/i18n/useLang'
import { useAuth } from '@/lib/firebase/useAuth'
import { subscribeToOrder, OrderDocument } from '@/lib/firebase/orders'
import { formatPrice } from '@/lib/format'

// Renders only from a live Firestore read of orders/{orderId} — never from
// URL params — since payment confirmation happens asynchronously via the
// Tranzila webhook (app/api/payments/tranzila-webhook). Trusting query
// params here would let anyone construct a "successful payment" URL by hand.
function CheckoutSuccessContent() {
  const { t } = useLang()
  const { user, loading } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()

  const orderId = searchParams.get('orderId')
  const [order, setOrder] = useState<OrderDocument | null | undefined>(undefined)

  useEffect(() => {
    if (!loading && !user) router.replace('/login')
  }, [loading, user, router])

  useEffect(() => {
    if (!orderId || !user) return
    const unsubscribe = subscribeToOrder(orderId, setOrder)
    return unsubscribe
  }, [orderId, user])

  if (loading || !user || !orderId) {
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
          <div className="bg-white border border-slate-100 rounded-2xl p-6 sm:p-8 shadow-sm text-center">
            {(order === undefined || order?.status === 'pending') && (
              <>
                <i className="fa-solid fa-spinner fa-spin text-brand text-2xl mb-4"></i>
                <h1 className="text-lg font-bold text-slate-900">{t('checkout_confirming_title')}</h1>
                <p className="text-sm text-slate-500 mt-1">{t('checkout_confirming_sub')}</p>
              </>
            )}

            {(order === null || order?.status === 'failed') && (
              <>
                <i className="fa-solid fa-circle-exclamation text-red-500 text-2xl mb-4"></i>
                <h1 className="text-lg font-bold text-slate-900">{t('checkout_failed_title')}</h1>
                <p className="text-sm text-slate-500 mt-1">{t('checkout_failed_sub')}</p>
              </>
            )}

            {order && order.status === 'paid' && (
              <>
                <div className="success-checkmark">
                  <i className="fa-solid fa-check"></i>
                </div>
                <h1 className="text-xl sm:text-2xl font-black text-slate-900 mb-1">{t('success_title')}</h1>
                <p className="text-sm text-slate-500 mb-6">{t('success_subtitle')}</p>

                <div className="text-start border-t border-slate-100 pt-5 space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-500">{t('checkout_offer_label')}</span>
                    <span className="font-bold text-slate-900">{order.offerTitle}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-500">{t('success_amount_paid_label')}</span>
                    <span className="font-bold text-slate-900" dir="ltr">{formatPrice(order.amount)}</span>
                  </div>
                </div>

                <Link href="/member" className="tap-target block w-full text-center bg-brand text-white font-bold py-3 rounded-full hover:bg-brandDark transition shadow-md mt-6">
                  {t('success_back_to_account')}
                </Link>
              </>
            )}
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

'use client'

import { Suspense, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import Navbar from '@/components/layout/Navbar'
import BackButton from '@/components/navigation/BackButton'
import { useLang } from '@/lib/i18n/useLang'
import { useAuth } from '@/lib/firebase/useAuth'
import { useOnboardingGuard } from '@/components/auth/useOnboardingGuard'
import { subscribeToOrder, OrderDocument } from '@/lib/firebase/orders'
import { subscribeToVoucher, type VoucherDocument } from '@/lib/firebase/vouchers'
import { formatPrice, priceDifference } from '@/lib/format'
import VoucherQRCode from '@/components/member/VoucherQRCode'
import VoucherTerms from '@/components/member/VoucherTerms'
import HowToRedeem from '@/components/offers/HowToRedeem'

// Renders only from a live Firestore read of orders/{orderId} — never from
// URL params — since payment confirmation happens asynchronously via the
// Tranzila webhook (app/api/payments/tranzila-webhook). Trusting query
// params here would let anyone construct a "successful payment" URL by hand.
// Once paid it doubles as the order confirmation: order number, itemised
// amount, and the voucher pass the webhook issued (code, validity, terms).
function CheckoutSuccessContent() {
  const { t } = useLang()
  const { user, loading } = useAuth()
  // Onboarding first: a member mid-wizard is sent back to it.
  const held = useOnboardingGuard()
  const router = useRouter()
  const searchParams = useSearchParams()

  const orderId = searchParams.get('orderId')
  const [order, setOrder] = useState<OrderDocument | null | undefined>(undefined)
  const [voucher, setVoucher] = useState<(VoucherDocument & { id: string }) | null>(null)

  useEffect(() => {
    if (!loading && !user) router.replace('/login')
  }, [loading, user, router])

  useEffect(() => {
    if (!orderId || !user) return
    const unsubscribe = subscribeToOrder(orderId, setOrder)
    return unsubscribe
  }, [orderId, user])

  // The pass the webhook issued with the payment (same id as the order).
  const voucherId = order?.status === 'paid' ? order.voucherId : null
  useEffect(() => {
    if (!voucherId) {
      setVoucher(null)
      return
    }
    return subscribeToVoucher(voucherId, setVoucher)
  }, [voucherId])

  if (loading || !user || held || !orderId) {
    return (
      <>
        <Navbar />
        <div className="pt-16 min-h-screen bg-slate-50" />
      </>
    )
  }

  const paid = order?.status === 'paid'
  const pending = order === undefined || order?.status === 'pending'
  const discount = paid && order.originalPrice ? priceDifference(order.originalPrice, order.amount) : 0

  return (
    <>
      <Navbar />
      <div className="pt-16 bg-slate-50 min-h-screen">
        <div className="max-w-lg mx-auto px-5 sm:px-6 pt-4 pb-8 sm:pt-8 sm:pb-10">
          {/* Never back into the payment step: always on to the member's passes. */}
          <BackButton fallback="/member" label={t('success_back_to_account')} force className="mb-3" />
          <div className="bg-white border border-slate-100 rounded-2xl p-6 sm:p-8 shadow-sm text-center">
            {/* One live region for every state, so the confirmation is announced as it arrives. */}
            <div role="status" aria-live="polite">
              {pending && (
                <>
                  <i className="fa-solid fa-spinner fa-spin text-brand text-2xl mb-4" aria-hidden="true"></i>
                  <h1 className="text-lg font-bold text-slate-900">{t('checkout_confirming_title')}</h1>
                  <p className="text-sm text-slate-500 mt-1">{t('checkout_confirming_sub')}</p>
                </>
              )}

              {!pending && !paid && (
                <>
                  <i className="fa-solid fa-circle-exclamation text-red-500 text-2xl mb-4" aria-hidden="true"></i>
                  <h1 className="text-lg font-bold text-slate-900">{t('checkout_failed_title')}</h1>
                  <p className="text-sm text-slate-500 mt-1">{t('checkout_failed_sub')}</p>
                </>
              )}

              {paid && (
                <>
                  <div className="success-checkmark" aria-hidden="true">
                    <i className="fa-solid fa-check" aria-hidden="true"></i>
                  </div>
                  <h1 className="text-xl sm:text-2xl font-black text-slate-900 mb-1">{t('success_title')}</h1>
                  <p className="text-sm text-slate-500 mb-6">{t('success_subtitle')}</p>
                </>
              )}
            </div>

            {paid && (
              <>
                <dl className="text-start border-t border-slate-100 pt-5 space-y-3">
                  <div className="flex items-center justify-between gap-4 text-sm">
                    <dt className="text-slate-500">{t('success_order_number_label')}</dt>
                    <dd className="font-mono text-xs text-slate-700 break-all text-end" dir="ltr">{orderId}</dd>
                  </div>
                  <div className="flex items-start justify-between gap-4 text-sm">
                    <dt className="text-slate-500 shrink-0">{t('checkout_offer_label')}</dt>
                    <dd className="font-bold text-slate-900 text-end">{order.offerTitle}</dd>
                  </div>
                  {order.originalPrice !== null && discount > 0 && (
                    <>
                      <div className="flex items-center justify-between text-sm">
                        <dt className="text-slate-500">{t('checkout_original_price_label')}</dt>
                        <dd className="text-slate-500 line-through" dir="ltr">{formatPrice(order.originalPrice)}</dd>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <dt className="text-slate-500">{t('checkout_discount_label')}</dt>
                        <dd className="font-semibold text-emerald-700" dir="ltr">-{formatPrice(discount)}</dd>
                      </div>
                    </>
                  )}
                  <div className="flex items-center justify-between gap-4 text-sm border-t border-slate-100 pt-3">
                    <dt className="text-slate-700 font-semibold">{t('success_amount_paid_label')} · {t('checkout_total_label')}</dt>
                    <dd className="font-black text-slate-900" dir="ltr">{formatPrice(order.amount)}</dd>
                  </div>
                </dl>

                {voucher && (
                  <section aria-label={t('voucher_redemption_code_label')} className="border-t border-slate-100 mt-5 pt-5 flex flex-col items-center gap-3">
                    <VoucherQRCode voucherId={voucher.id} />
                    <div>
                      <div className="text-xs text-slate-500 mb-1">{t('voucher_redemption_code_label')}</div>
                      <div className="text-2xl font-black text-slate-900 tracking-[0.2em]" dir="ltr">{voucher.redemptionCode}</div>
                    </div>
                    <div className="w-full text-start mt-2 border-t border-slate-100 pt-4">
                      <HowToRedeem method={voucher.redemptionMethod} instructions={voucher.redemptionInstructions} variant="inline" />
                    </div>
                    <div className="w-full text-start mt-2">
                      <VoucherTerms voucher={voucher} />
                    </div>
                  </section>
                )}

                <p className="flex items-center justify-center gap-2 text-xs text-slate-500 mt-5">
                  <i className="fa-regular fa-envelope" aria-hidden="true"></i>
                  <span>{t('success_receipt_note')}</span>
                </p>

                <Link href="/member" className="tap-target block w-full text-center bg-brand text-white font-bold py-3 rounded-full hover:bg-brandDark transition shadow-md mt-6 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2">
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

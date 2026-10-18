'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Navbar from '@/components/layout/Navbar'
import TranzilaPaymentWidget from '@/components/checkout/TranzilaPaymentWidget'
import Checkbox from '@/components/auth/entrance/Checkbox'
import ConsentText from '@/components/auth/entrance/ConsentText'
import { useLang } from '@/lib/i18n/useLang'
import { useAuth } from '@/lib/firebase/useAuth'
import { useOnboardingGuard } from '@/components/auth/useOnboardingGuard'
import { formatPrice, priceDifference } from '@/lib/format'
import { cancellationFeeAgorot } from '@/lib/payments/voucherTerms'

type CheckoutStep = 'summary' | 'payment'

// What /api/payments/initiate returns: the order as frozen when it was created.
interface OrderSummary {
  orderId: string
  amount: number
  originalPrice: number | null
  offerTitle: string
  businessName: string
  validityDays: number
  redemptionTerms: string
  termsAccepted: boolean
}

const AGREE_ERROR_ID = 'checkout-agree-error'

async function initiate(idToken: string, offerId: string, acceptTerms: boolean) {
  const res = await fetch('/api/payments/initiate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
    body: JSON.stringify(acceptTerms ? { offerId, acceptTerms: true } : { offerId }),
  })
  return { ok: res.ok, data: await res.json() }
}

// The order summary is the member's pre-contract disclosure: the itemised
// price (VAT included), what the voucher is valid for and under which terms,
// and the cancellation policy, with the Terms/Refund checkbox required before
// the payment step. Accepting is recorded on the order (termsAcceptedAt).
function CheckoutContent() {
  const { t } = useLang()
  const { user, loading } = useAuth()
  // Onboarding first: a member mid-wizard is sent back to it.
  const held = useOnboardingGuard()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [step, setStep] = useState<CheckoutStep>('summary')
  const [order, setOrder] = useState<OrderSummary | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [agreed, setAgreed] = useState(false)
  const [agreeMissing, setAgreeMissing] = useState(false)
  const [proceeding, setProceeding] = useState(false)
  const [payError, setPayError] = useState<string | null>(null)

  const offerId = searchParams.get('offerId')

  useEffect(() => {
    if (!loading && !user) router.replace('/login')
  }, [loading, user, router])

  useEffect(() => {
    if (!offerId) {
      router.replace('/categories')
      return
    }
    // No order is created for a member who still owes onboarding.
    if (!user || held) return

    let cancelled = false
    ;(async () => {
      try {
        const { ok, data } = await initiate(await user.getIdToken(), offerId, false)
        if (cancelled) return
        if (!ok) {
          setError(data.error ?? t('checkout_error_generic'))
          return
        }
        setOrder(data as OrderSummary)
        // Back on an order already accepted: the box stays ticked.
        if (data.termsAccepted) setAgreed(true)
      } catch {
        if (!cancelled) setError(t('checkout_error_generic'))
      }
    })()
    return () => { cancelled = true }
  }, [user, held, offerId, router, t])

  const handlePay = async () => {
    if (!agreed) {
      setAgreeMissing(true)
      return
    }
    if (!user || !offerId) return
    setPayError(null)
    setProceeding(true)
    try {
      const { ok, data } = await initiate(await user.getIdToken(), offerId, true)
      if (!ok) {
        setPayError(data.error ?? t('checkout_error_generic'))
        return
      }
      setStep('payment')
    } catch {
      setPayError(t('checkout_error_generic'))
    } finally {
      setProceeding(false)
    }
  }

  if (loading || !user || held || (!order && !error)) {
    return (
      <>
        <Navbar />
        <div className="pt-16 min-h-screen bg-slate-50">
          <div role="status" className="max-w-lg mx-auto px-5 sm:px-6 py-16 flex flex-col items-center gap-3 text-slate-500">
            <i className="fa-solid fa-spinner fa-spin text-brand text-2xl" aria-hidden="true"></i>
            <span className="text-sm">{t('checkout_loading')}</span>
          </div>
        </div>
      </>
    )
  }

  const discount = order?.originalPrice ? priceDifference(order.originalPrice, order.amount) : 0
  const fee = order ? cancellationFeeAgorot(Math.round(order.amount * 100)) / 100 : 0

  return (
    <>
      <Navbar />
      <div className="pt-16 bg-slate-50 min-h-screen">
        <div className="max-w-lg mx-auto px-5 sm:px-6 py-8 sm:py-10">
          <div className="text-xs font-bold tracking-widest text-brand uppercase mb-1">{t('checkout_label')}</div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 mb-6">{t('checkout_title')}</h1>

          {error && !order && (
            <div role="alert" className="bg-white border border-slate-100 rounded-2xl p-6 sm:p-8 shadow-sm text-center">
              <i className="fa-solid fa-circle-exclamation text-red-500 text-2xl mb-3" aria-hidden="true"></i>
              <p className="text-sm text-slate-600">{error}</p>
            </div>
          )}

          {order && step === 'summary' && (
            <div className="bg-white border border-slate-100 rounded-2xl p-6 sm:p-8 shadow-sm">
              <div className="flex items-start justify-between gap-4 mb-1">
                <span className="text-sm font-semibold text-slate-500 shrink-0">{t('checkout_offer_label')}</span>
                <span className="text-sm font-bold text-slate-900 text-end">{order.offerTitle}</span>
              </div>
              <div className="text-xs text-slate-500 text-end mb-5">{order.businessName}</div>

              <dl className="border-t border-slate-100 pt-5 space-y-2.5">
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
                <div className="flex items-center justify-between gap-4 border-t border-slate-100 pt-3">
                  <dt className="text-base font-bold text-slate-900">{t('checkout_total_label')}</dt>
                  <dd className="text-xl font-black text-brand" dir="ltr">{formatPrice(order.amount)}</dd>
                </div>
              </dl>
              <p className="text-xs text-slate-500 mt-2">{t('checkout_vat_note')}</p>

              <section aria-labelledby="checkout-voucher-heading" className="border-t border-slate-100 mt-5 pt-5">
                <h2 id="checkout-voucher-heading" className="text-sm font-bold text-slate-900 mb-2">{t('checkout_voucher_details_title')}</h2>
                <p className="flex items-center gap-2 text-sm text-slate-600">
                  <i className="fa-regular fa-calendar-check text-brand" aria-hidden="true"></i>
                  <span>{t('checkout_validity').replace('{days}', String(order.validityDays))}</span>
                </p>
                {order.redemptionTerms && (
                  <div className="mt-3">
                    <h3 className="text-xs font-bold text-slate-700 mb-1">{t('voucher_redemption_terms_label')}</h3>
                    <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-line">{order.redemptionTerms}</p>
                  </div>
                )}
              </section>

              <section aria-labelledby="checkout-cancellation-heading" className="border-t border-slate-100 mt-5 pt-5">
                <h2 id="checkout-cancellation-heading" className="text-sm font-bold text-slate-900 mb-2">{t('checkout_cancellation_title')}</h2>
                <p className="text-sm text-slate-600 leading-relaxed">
                  {t('checkout_cancellation_body').replace('{fee}', formatPrice(fee))}
                </p>
              </section>

              <div className="border-t border-slate-100 mt-5 pt-5">
                <Checkbox
                  label={<span className="text-sm leading-5 text-slate-700"><ConsentText template={t('checkout_agree')} t={t} /></span>}
                  checked={agreed}
                  onChange={(checked) => {
                    setAgreed(checked)
                    if (checked) setAgreeMissing(false)
                  }}
                  invalid={agreeMissing}
                  describedBy={agreeMissing ? AGREE_ERROR_ID : undefined}
                />
                {agreeMissing && (
                  <p id={AGREE_ERROR_ID} role="alert" className="mt-2 text-[13px] font-semibold text-red-600">
                    {t('checkout_agree_required')}
                  </p>
                )}
              </div>

              {payError && (
                <p role="alert" className="mt-4 text-sm font-semibold text-red-600">{payError}</p>
              )}

              <button
                type="button"
                onClick={handlePay}
                disabled={proceeding}
                aria-busy={proceeding || undefined}
                className="tap-target block w-full text-center bg-brand text-white font-bold py-3 rounded-full hover:bg-brandDark transition shadow-md mt-6 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 disabled:opacity-60"
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

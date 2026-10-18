'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Navbar from '@/components/layout/Navbar'
import BackButton from '@/components/navigation/BackButton'
import TranzilaPaymentWidget from '@/components/checkout/TranzilaPaymentWidget'
import DevSandboxPaymentWidget from '@/components/checkout/DevSandboxPaymentWidget'
import CheckoutTrustBadges from '@/components/checkout/CheckoutTrustBadges'
import ConsentText from '@/components/auth/entrance/ConsentText'
import PerkImage from '@/components/discover/PerkImage'
import RedemptionBadge from '@/components/discover/RedemptionBadge'
import { useLang } from '@/lib/i18n/useLang'
import { useAuth } from '@/lib/firebase/useAuth'
import { getOffer, type OfferDocument } from '@/lib/firebase/offers'
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
  /** A local development sandbox order (lib/payments/devSandbox.ts). */
  sandbox: boolean
  /** A sandbox order left unfinished earlier, picked up again. */
  resumed: boolean
}

// `restart` only means something to the local dev sandbox (lib/payments/devSandbox.ts).
async function initiate(idToken: string, offerId: string, acceptTerms: boolean, restart = false) {
  const res = await fetch('/api/payments/initiate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
    body: JSON.stringify({ offerId, ...(acceptTerms && { acceptTerms: true }), ...(restart && { restart: true }) }),
  })
  // A non-JSON error page (a proxy, a crashed dev server) still reads as an error.
  return { ok: res.ok, data: await res.json().catch(() => ({})) }
}

// The order summary is the member's pre-contract disclosure: the itemised
// price (VAT included), what the voucher is valid for and under which terms,
// and the cancellation policy. Accepting the Terms is clickwrap: the line
// above the Pay button says that paying accepts them, and Pay records it on
// the order (termsAcceptedAt) before the payment step.
//
// The order freezes the price and terms; the photo, category and redemption
// method come from the live offer, for show only. On phones the Pay bar
// sticks to the bottom of the screen, clear of the home indicator.
function CheckoutContent() {
  const { t } = useLang()
  const { user, loading } = useAuth()
  // Onboarding first: a member mid-wizard is sent back to it.
  const held = useOnboardingGuard()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [step, setStep] = useState<CheckoutStep>('summary')
  const [order, setOrder] = useState<OrderSummary | null>(null)
  const [offer, setOffer] = useState<OfferDocument | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [proceeding, setProceeding] = useState(false)
  const [payError, setPayError] = useState<string | null>(null)
  const [showResume, setShowResume] = useState(false)
  const [restarting, setRestarting] = useState(false)

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
        if (data.sandbox && data.resumed) setShowResume(true)
      } catch {
        if (!cancelled) setError(t('checkout_error_generic'))
      }
    })()
    return () => { cancelled = true }
  }, [user, held, offerId, router, t])

  // The photo is decoration: without it the summary shows the category panel.
  useEffect(() => {
    if (!offerId) return
    let cancelled = false
    getOffer(offerId)
      .then((next) => { if (!cancelled) setOffer(next) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [offerId])

  const handlePay = async () => {
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

  // Sandbox only: carry on with the unfinished test order.
  const handleResume = () => {
    setShowResume(false)
    if (order?.termsAccepted) setStep('payment')
  }

  // Sandbox only: archive the unfinished test order and open a fresh one.
  const handleRestart = async () => {
    if (!user || !offerId) return
    setPayError(null)
    setRestarting(true)
    try {
      const { ok, data } = await initiate(await user.getIdToken(), offerId, false, true)
      if (!ok) {
        setPayError(data.error ?? t('checkout_error_generic'))
        return
      }
      setOrder(data as OrderSummary)
      setShowResume(false)
      setStep('summary')
    } catch {
      setPayError(t('checkout_error_generic'))
    } finally {
      setRestarting(false)
    }
  }

  const backFallback = offerId ? `/offers/${encodeURIComponent(offerId)}` : '/categories'

  if (loading || !user || held || (!order && !error)) {
    return (
      <>
        <Navbar />
        <div className="checkout-canvas pt-16 min-h-screen min-h-dvh">
          <div role="status" className="max-w-xl mx-auto px-5 sm:px-6 py-16 flex flex-col items-center gap-3 text-slate-500">
            <i className="fa-solid fa-spinner fa-spin text-brand text-2xl" aria-hidden="true"></i>
            <span className="text-sm">{t('checkout_loading')}</span>
          </div>
        </div>
      </>
    )
  }

  const discount = order?.originalPrice ? priceDifference(order.originalPrice, order.amount) : 0
  const fee = order ? cancellationFeeAgorot(Math.round(order.amount * 100)) / 100 : 0
  const payLabel = order ? t('checkout_pay_button').replace('{price}', formatPrice(order.amount)) : ''

  return (
    <>
      <Navbar />
      <div className="checkout-canvas pt-16 min-h-screen min-h-dvh">
        <div className="max-w-xl mx-auto px-5 sm:px-6 pt-4 sm:pt-8 pb-6 sm:pb-12">
          <BackButton fallback={backFallback} className="mb-3" />
          <div className="text-xs font-bold tracking-widest text-brand uppercase mb-1">{t('checkout_label')}</div>
          <h1 className="text-2xl sm:text-3xl font-black text-ink mb-6">{t('checkout_title')}</h1>

          {error && !order && (
            <div role="alert" className="bg-white border border-slate-100 rounded-3xl p-6 sm:p-8 shadow-sm text-center">
              <i className="fa-solid fa-circle-exclamation text-red-500 text-2xl mb-3" aria-hidden="true"></i>
              <p className="text-sm text-slate-600">{error}</p>
            </div>
          )}

          {order && step === 'summary' && order.sandbox && showResume && (
            <section aria-labelledby="checkout-resume-heading" className="bg-amber-50 border border-amber-200 rounded-2xl p-5 mb-4">
              <h2 id="checkout-resume-heading" className="flex items-center gap-2 text-sm font-bold text-amber-900">
                <i className="fa-solid fa-clock-rotate-left" aria-hidden="true"></i>
                <span>{t('checkout_sandbox_resume_title')}</span>
              </h2>
              <p className="text-sm text-amber-900/80 mt-1 leading-relaxed">{t('checkout_sandbox_resume_sub')}</p>
              <div className="flex flex-col sm:flex-row gap-3 mt-4">
                <button
                  type="button"
                  onClick={handleResume}
                  disabled={restarting}
                  className="tap-target min-h-12 flex-1 inline-flex items-center justify-center gap-2 bg-brand text-white font-bold text-sm px-4 rounded-full transition [@media(hover:hover)]:hover:bg-brandDark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 disabled:opacity-60"
                >
                  <i className="fa-solid fa-play text-xs rtl:-scale-x-100" aria-hidden="true"></i>
                  <span>{t('checkout_sandbox_resume_button')}</span>
                </button>
                <button
                  type="button"
                  onClick={handleRestart}
                  disabled={restarting}
                  aria-busy={restarting || undefined}
                  className="tap-target min-h-12 flex-1 inline-flex items-center justify-center gap-2 bg-white text-slate-800 border border-slate-300 font-bold text-sm px-4 rounded-full transition [@media(hover:hover)]:hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 disabled:opacity-60"
                >
                  <i className={`fa-solid ${restarting ? 'fa-spinner fa-spin' : 'fa-rotate-right'} text-xs`} aria-hidden="true"></i>
                  <span>{t('checkout_sandbox_reset_button')}</span>
                </button>
              </div>
            </section>
          )}

          {order && step === 'summary' && (
            <>
              <article className="relative overflow-hidden rounded-3xl bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04),0_16px_40px_-20px_rgba(0,56,184,0.35)] ring-1 ring-slate-200/70">
                <div aria-hidden="true" className="h-1.5 bg-gradient-to-r from-[#0038B8] via-[#2563EB] to-emerald-500" />
                <div className="p-5 sm:p-7">
                  {/* Who and what: photo (or the category panel), business, offer, method. */}
                  <div className="flex items-start gap-4">
                    <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-2xl bg-[#F0F7FF] ring-1 ring-slate-200/70">
                      {offer && (
                        <PerkImage src={offer.imageUrl} alt="" category={offer.category} businessName={offer.businessName} />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-bold tracking-widest text-brand uppercase truncate" dir="auto">{order.businessName}</div>
                      <h2 className="mt-1 text-lg font-bold leading-snug text-ink" dir="auto">{order.offerTitle}</h2>
                      {offer && <RedemptionBadge method={offer.redemptionMethod} className="mt-2" />}
                    </div>
                  </div>

                  {/* The itemised price, VAT included, and what the member saves. */}
                  <div className="mt-6 rounded-2xl bg-gradient-to-br from-[#F0F7FF] to-white p-4 sm:p-5 ring-1 ring-[#DCE8FF]">
                    <dl className="space-y-2">
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
                      <div className="flex items-end justify-between gap-4 pt-1">
                        <dt className="text-base font-bold text-ink">{t('checkout_total_label')}</dt>
                        <dd className="text-3xl font-black tracking-tight text-brand" dir="ltr">{formatPrice(order.amount)}</dd>
                      </div>
                    </dl>
                    <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                      <p className="text-xs text-slate-500">{t('checkout_vat_note')}</p>
                      {discount > 0 && (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700 ring-1 ring-emerald-200">
                          <i className="fa-solid fa-piggy-bank" aria-hidden="true"></i>
                          <span>{t('checkout_you_save').replace('{amount}', formatPrice(discount))}</span>
                        </span>
                      )}
                    </div>
                  </div>

                  <section aria-labelledby="checkout-voucher-heading" className="mt-6">
                    <h2 id="checkout-voucher-heading" className="text-sm font-bold text-ink mb-2">{t('checkout_voucher_details_title')}</h2>
                    <p className="flex items-center gap-2 text-sm text-slate-600">
                      <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-[#F0F7FF] text-brand">
                        <i className="fa-regular fa-calendar-check text-xs" aria-hidden="true"></i>
                      </span>
                      <span>{t('checkout_validity').replace('{days}', String(order.validityDays))}</span>
                    </p>
                    {order.redemptionTerms && (
                      <div className="mt-3 rounded-xl bg-slate-50 p-3">
                        <h3 className="text-xs font-bold text-slate-700 mb-1">{t('voucher_redemption_terms_label')}</h3>
                        <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-line" dir="auto">{order.redemptionTerms}</p>
                      </div>
                    )}
                  </section>

                  <section aria-labelledby="checkout-cancellation-heading" className="mt-6 border-t border-slate-100 pt-5">
                    <h2 id="checkout-cancellation-heading" className="text-sm font-bold text-ink mb-2">{t('checkout_cancellation_title')}</h2>
                    <p className="text-sm text-slate-600 leading-relaxed">
                      {t('checkout_cancellation_body').replace('{fee}', formatPrice(fee))}
                    </p>
                  </section>
                </div>
              </article>

              <CheckoutTrustBadges className="mt-5" />

              {/* Sticky on phones (above the home indicator), in the flow from 640px. */}
              <div className="checkout-paybar sticky bottom-0 z-10 -mx-5 mt-5 px-5 pt-4 sm:static sm:mx-0 sm:px-0 sm:pt-0">
                <p className="mb-3 text-center text-xs leading-5 text-slate-600">
                  <ConsentText template={t('checkout_agree').replace('{price}', formatPrice(order.amount))} t={t} />
                </p>
                {payError && (
                  <p role="alert" className="mb-3 text-center text-sm font-semibold text-red-600">{payError}</p>
                )}
                <button
                  type="button"
                  onClick={handlePay}
                  disabled={proceeding}
                  aria-busy={proceeding || undefined}
                  className="checkout-pay tap-target flex h-14 w-full items-center justify-center gap-2 rounded-full text-base font-bold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 disabled:opacity-60"
                >
                  <i className={`fa-solid ${proceeding ? 'fa-spinner fa-spin' : 'fa-lock'} text-sm`} aria-hidden="true"></i>
                  <span dir="auto">{payLabel}</span>
                </button>
              </div>
            </>
          )}

          {order && step === 'payment' && (order.sandbox ? (
            <DevSandboxPaymentWidget orderId={order.orderId} offerTitle={order.offerTitle} amount={order.amount} onBack={() => setStep('summary')} />
          ) : (
            <TranzilaPaymentWidget offerTitle={order.offerTitle} amount={order.amount} onBack={() => setStep('summary')} />
          ))}
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

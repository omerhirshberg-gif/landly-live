'use client'

import { Suspense, useEffect, useState } from 'react'
import Link from 'next/link'
import { Check, CircleAlert, Copy, LoaderCircle, Mail, PiggyBank, QrCode, Wallet, X } from 'lucide-react'
import { useRouter, useSearchParams } from 'next/navigation'
import Navbar from '@/components/layout/Navbar'
import Confetti from '@/components/checkout/Confetti'
import PerkImage from '@/components/discover/PerkImage'
import { useLang } from '@/lib/i18n/useLang'
import { localizeText } from '@/lib/i18n/contentTranslation'
import { localizedBusinessName } from '@/lib/business/businessText'
import { useAuth } from '@/lib/firebase/useAuth'
import { useOnboardingGuard } from '@/components/auth/useOnboardingGuard'
import { getOffer, type OfferDocument } from '@/lib/firebase/offers'
import { subscribeToOrder, type OrderDocument } from '@/lib/firebase/orders'
import { formatPrice, priceDifference } from '@/lib/format'
import { orderReference } from '@/lib/payments/orderNumber'

const FOCUS = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2'

// The order confirmation, reached by replacing the checkout in history (the
// dev sandbox widget; /checkout/success, Tranzila's return URL, redirects
// here), so back never lands on the payment step. Renders only from a live
// Firestore read of orders/{orderId} -- never from URL params -- since
// payment is confirmed asynchronously by the Tranzila webhook: trusting the
// query would let anyone build a "successful payment" URL by hand. Once paid:
// a confetti burst, the check, the order number with copy, what was bought,
// paid and saved, and the way on to the voucher. The Expo app's counterpart
// is landly-mobile/src/app/order-success/[orderId].tsx.
function OrderSuccessContent() {
  const { t, lang } = useLang()
  const { user, loading } = useAuth()
  // Onboarding first: a member mid-wizard is sent back to it.
  const held = useOnboardingGuard()
  const router = useRouter()
  const searchParams = useSearchParams()

  const orderId = searchParams.get('orderId')
  const [order, setOrder] = useState<OrderDocument | null | undefined>(undefined)
  const [offer, setOffer] = useState<OfferDocument | null>(null)

  useEffect(() => {
    if (!loading && !user) router.replace('/login')
  }, [loading, user, router])

  useEffect(() => {
    if (!orderId || !user) return
    return subscribeToOrder(orderId, setOrder)
  }, [orderId, user])

  // The thumbnail is decoration from the live offer; the order holds what was bought.
  const offerId = order?.offerId
  useEffect(() => {
    if (!offerId) return
    let cancelled = false
    getOffer(offerId)
      .then((next) => { if (!cancelled) setOffer(next) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [offerId])

  const paid = order?.status === 'paid'
  // A short buzz where the browser supports it (Android Chrome); a no-op elsewhere.
  useEffect(() => {
    if (paid) navigator.vibrate?.([30, 40, 30])
  }, [paid])

  if (loading || !user || held || !orderId) {
    return (
      <>
        <Navbar />
        <div className="below-header member-canvas" />
      </>
    )
  }

  const pending = order === undefined || order?.status === 'pending'
  const discount = paid && order.originalPrice ? priceDifference(order.originalPrice, order.amount) : 0
  const voucherId = paid ? order.voucherId : null

  return (
    <>
      <Navbar />
      {paid && <Confetti />}
      <div className="below-header member-canvas">
        <div className="max-w-lg mx-auto px-5 sm:px-6 pt-6 pb-8 sm:pt-10 sm:pb-10">
          <div className="bg-white border border-slate-100 rounded-3xl p-6 sm:p-8 shadow-card text-center">
            {/* One live region for every state, so the confirmation is announced as it arrives. */}
            <div role="status" aria-live="polite">
              {pending && (
                <>
                  <LoaderCircle aria-hidden="true" className="mx-auto mb-4 h-7 w-7 animate-spin text-brand motion-reduce:animate-none" strokeWidth={1.75} />
                  <h1 className="text-lg font-bold text-slate-900">{t('checkout_confirming_title')}</h1>
                  <p className="text-sm text-slate-500 mt-1">{t('checkout_confirming_sub')}</p>
                </>
              )}

              {!pending && !paid && (
                <>
                  <CircleAlert aria-hidden="true" className="mx-auto mb-4 h-7 w-7 text-red-500" strokeWidth={1.75} />
                  <h1 className="text-lg font-bold text-slate-900">{t('checkout_failed_title')}</h1>
                  <p className="text-sm text-slate-500 mt-1">{t('checkout_failed_sub')}</p>
                  <Link href="/member" className="ds-btn ds-btn-primary mt-6">
                    {t('success_back_to_account')}
                  </Link>
                </>
              )}

              {paid && (
                <>
                  <div className="success-checkmark" aria-hidden="true">
                    <Check aria-hidden="true" className="h-8 w-8" strokeWidth={2} />
                  </div>
                  <h1 className="text-2xl sm:text-3xl font-black text-ink mb-1">{t('success_celebration_title')}</h1>
                  <p className="text-sm text-slate-500">{t('success_subtitle')}</p>
                </>
              )}
            </div>

            {paid && (
              <>
                {/* What was bought: thumbnail, business and perk, paid and saved. */}
                <div className="mt-6 flex items-center gap-4 rounded-2xl bg-brandTint p-4 text-start ring-1 ring-brandLight">
                  <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-white ring-1 ring-slate-200/70">
                    {offer && <PerkImage src={offer.imageUrl} alt="" category={offer.category} businessName={offer.businessName} />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-xs font-bold uppercase tracking-widest text-brand" dir="auto">{localizedBusinessName(order, lang).text}</div>
                    <div className="mt-0.5 font-bold leading-snug text-ink" dir="auto">{localizeText(order.offerTitle, order.translations, lang, 'title').text}</div>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <span className="text-sm text-slate-600">
                        {t('success_amount_paid_label')}: <span className="font-black text-ink" dir="ltr">{formatPrice(order.amount)}</span>
                      </span>
                      {discount > 0 && (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-bold text-emerald-700 ring-1 ring-emerald-200">
                          <PiggyBank aria-hidden="true" className="h-3.5 w-3.5" strokeWidth={1.75} />
                          <span>{t('checkout_you_save').replace('{amount}', formatPrice(discount))}</span>
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="mt-4 flex items-center justify-between gap-3 rounded-2xl border border-slate-100 px-4 py-3 text-start">
                  <div className="min-w-0">
                    <div className="text-xs text-slate-500">{t('success_order_number_label')}</div>
                    <div className="truncate font-mono text-sm text-slate-800" dir="ltr">{orderReference(order.displayOrderNumber, orderId)}</div>
                  </div>
                  <CopyOrderIdButton value={order.displayOrderNumber ?? orderId} />
                </div>

                <p className="mt-5 flex items-center justify-center gap-2 text-sm font-semibold text-emerald-700">
                  <Wallet aria-hidden="true" className="h-4 w-4" strokeWidth={1.75} />
                  <span>{t('success_voucher_ready')}</span>
                </p>
                <p className="mt-2 flex items-center justify-center gap-2 text-xs text-slate-500">
                  <Mail aria-hidden="true" className="h-3.5 w-3.5" strokeWidth={1.75} />
                  <span>{t('success_receipt_note')}</span>
                </p>

                {/* Sticky above the home indicator on phones, in the flow from 640px.
                    The WhatsApp widget rises above it there (data-floating-clearance). */}
                <div data-floating-clearance="" className="sticky bottom-0 -mx-6 mt-6 flex flex-col gap-2 bg-white px-6 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] sm:static sm:mx-0 sm:px-0 sm:pb-0">
                  {voucherId && (
                    <Link
                      href={`/member/vouchers/${encodeURIComponent(voucherId)}`}
                      className="ds-btn ds-btn-primary ds-btn-wrap w-full"
                    >
                      <QrCode aria-hidden="true" className="h-4 w-4" strokeWidth={1.75} />
                      <span>{t('success_view_voucher')}</span>
                    </Link>
                  )}
                  <Link
                    href="/member"
                    className="ds-btn ds-btn-secondary ds-btn-wrap w-full"
                  >
                    {t('success_to_my_pass')}
                  </Link>
                  <Link href="/categories" className={`tap-target flex min-h-12 w-full items-center justify-center rounded-xl py-2 text-sm font-bold text-brand ${FOCUS}`}>
                    {t('success_keep_exploring')}
                  </Link>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  )
}

/**
 * Copies the order number as shown ("#1001"; the bare id for an order settled
 * before numbering). The Clipboard API needs a secure context; on a LAN http
 * address it reports a failure.
 */
function CopyOrderIdButton({ value }: { value: string }) {
  const { t } = useLang()
  const [status, setStatus] = useState<'idle' | 'copied' | 'failed'>('idle')

  useEffect(() => {
    if (status === 'idle') return
    const timer = setTimeout(() => setStatus('idle'), 2000)
    return () => clearTimeout(timer)
  }, [status])

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value)
      setStatus('copied')
    } catch {
      setStatus('failed')
    }
  }

  const [Icon, tone] = status === 'copied' ? [Check, 'text-emerald-600'] : status === 'failed' ? [X, 'text-red-600'] : [Copy, 'text-brand']
  return (
    <>
      <button
        type="button"
        onClick={copy}
        aria-label={t('success_copy_order_id')}
        className={`tap-target inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-brandTint transition [@media(hover:hover)]:hover:bg-brandLight ${FOCUS}`}
      >
        <Icon aria-hidden="true" className={`h-[18px] w-[18px] ${tone}`} strokeWidth={1.75} />
      </button>
      <span role="status" className="sr-only">
        {status === 'copied' ? t('success_order_id_copied') : status === 'failed' ? t('voucher_copy_failed') : ''}
      </span>
    </>
  )
}

export default function OrderSuccessPage() {
  return (
    <Suspense fallback={null}>
      <OrderSuccessContent />
    </Suspense>
  )
}

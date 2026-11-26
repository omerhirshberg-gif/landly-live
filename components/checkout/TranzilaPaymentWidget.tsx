'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, LoaderCircle } from 'lucide-react'
import TranzilaHostedFields from '@/components/checkout/TranzilaHostedFields'
import { useLang } from '@/lib/i18n/useLang'
import { useAuth } from '@/lib/firebase/useAuth'
import { subscribeToOrder } from '@/lib/firebase/orders'
import { formatPrice } from '@/lib/format'
import { confirmPayment } from '@/lib/payments/checkoutClient'
import type { CardFrameErrorCode, CardFrameEvent, HostedPaymentParams } from '@/lib/payments/hostedFieldsProtocol'

interface TranzilaPaymentWidgetProps {
  orderId: string
  offerTitle: string
  amount: number
  /** The Handshake (thtk) and notify URL for this order; null until the server issues them. */
  payment: HostedPaymentParams | null
  /** Asks the server for a fresh Handshake (the thtk lasts 20 minutes). */
  onRefreshPayment: () => Promise<void>
  onBack: () => void
}

// Seconds between asks to /api/payments/confirm while Tranzila has not answered yet.
const CONFIRM_DELAYS_MS = [1500, 2500, 4000, 6000, 8000, 10000]
// Ask for a new thtk this long before the old one lapses.
const REFRESH_MARGIN_MS = 60_000

// The card step of the website's checkout (the app's twin: landly-mobile TranzilaPaymentStep). Hosted Fields keep the card
// in Tranzila's own iframes inside this page. When the charge goes through, this asks the server to confirm it; the voucher
// exists only once the server has verified the transaction with Tranzila, and the order listener below is what moves the
// member on to the confirmation. Nothing here marks a payment as paid.
export default function TranzilaPaymentWidget({ orderId, offerTitle, amount, payment, onRefreshPayment, onBack }: TranzilaPaymentWidgetProps) {
  const { t, lang } = useLang()
  const { user } = useAuth()
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<CardFrameErrorCode | null>(null)
  const [delayed, setDelayed] = useState(false)
  const done = useRef(false)
  const confirming = useRef(false)

  const finish = useCallback(() => {
    if (done.current) return
    done.current = true
    // Replaced, so back from the confirmation never returns to the payment step.
    router.replace(`/order-success?orderId=${encodeURIComponent(orderId)}`)
  }, [orderId, router])

  // The server settles; this page only listens.
  useEffect(() => subscribeToOrder(orderId, (order) => {
    if (order?.status === 'paid') finish()
    else if (order?.status === 'failed' && !done.current) { setBusy(false); setError('declined') }
  }), [orderId, finish])

  // A thtk is good for 20 minutes: renew it before it lapses, without recreating the fields (the member's typing stays).
  const expiresAtMs = payment?.expiresAtMs
  useEffect(() => {
    if (!expiresAtMs) return
    const timer = setTimeout(() => { onRefreshPayment().catch(() => {}) }, Math.max(0, expiresAtMs - REFRESH_MARGIN_MS - Date.now()))
    return () => clearTimeout(timer)
  }, [expiresAtMs, onRefreshPayment])

  const confirm = useCallback(async () => {
    if (!user || confirming.current) return
    confirming.current = true
    setBusy(true)
    setDelayed(false)
    try {
      for (let i = 0; i <= CONFIRM_DELAYS_MS.length && !done.current; i++) {
        const result = await confirmPayment(await user.getIdToken(), orderId)
        if (result.ok && result.data.status === 'paid') return finish()
        if (result.ok && result.data.status === 'failed') { setBusy(false); setError('declined'); return }
        if (!result.ok && (result.reason === 'unauthorized' || result.reason === 'conflict')) break
        if (i < CONFIRM_DELAYS_MS.length) await new Promise((r) => setTimeout(r, CONFIRM_DELAYS_MS[i]))
      }
      // Still no answer from Tranzila's side: stay on the page (the listener still moves the member on) and never invite a second charge.
      if (!done.current) setDelayed(true)
    } catch {
      if (!done.current) setDelayed(true)
    } finally {
      confirming.current = false
    }
  }, [user, orderId, finish])

  const onEvent = useCallback((event: CardFrameEvent) => {
    if (event.type === 'submitting') setError(null)
    else if (event.type === 'charged') void confirm()
    else if (event.type === 'error' && event.code === 'thtk_expired') onRefreshPayment().catch(() => {})
  }, [confirm, onRefreshPayment])

  const priceLabel = formatPrice(amount)

  return (
    <div className="rounded-3xl border border-slate-200/80 bg-white/80 p-5 shadow-[0_8px_30px_rgb(0,0,0,0.04)] backdrop-blur-md sm:p-8 pb-[calc(1.25rem+env(safe-area-inset-bottom))] sm:pb-8">
      <div className="mb-6 flex items-center justify-between gap-4 rounded-2xl bg-gradient-to-br from-blue-50/60 to-indigo-50/20 px-4 py-3 ring-1 ring-brandLight">
        <span className="min-w-0 truncate text-start text-sm font-semibold text-slate-700" dir="auto">{offerTitle}</span>
        <bdi dir="ltr" className="flex-shrink-0 text-lg font-black tracking-tight text-brand">{priceLabel}</bdi>
      </div>

      {payment ? (
        <TranzilaHostedFields
          payment={payment}
          lang={lang}
          priceLabel={priceLabel}
          busy={busy}
          externalError={error}
          onEvent={onEvent}
        />
      ) : (
        <div role="status" className="flex items-center justify-center gap-2 py-10 text-sm text-slate-500">
          <LoaderCircle aria-hidden="true" className="h-4 w-4 animate-spin motion-reduce:animate-none" strokeWidth={2} />
          <span>{t('checkout_card_loading')}</span>
        </div>
      )}

      {busy && !delayed && <p role="status" className="mt-3 text-start text-sm text-slate-600" dir="auto">{t('checkout_card_confirming')}</p>}
      {delayed && <p role="status" className="mt-3 text-start text-sm font-semibold text-amber-800" dir="auto">{t('checkout_card_confirm_delayed')}</p>}

      <button
        type="button"
        onClick={onBack}
        disabled={busy}
        className="tap-target mt-5 inline-flex min-h-12 items-center gap-2 rounded-full text-sm font-bold text-brand hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 disabled:opacity-50"
      >
        <ArrowLeft aria-hidden="true" className="h-3.5 w-3.5 rtl:-scale-x-100" strokeWidth={2} />
        <span>{t('checkout_back_to_summary')}</span>
      </button>
    </div>
  )
}

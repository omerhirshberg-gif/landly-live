'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useLang } from '@/lib/i18n/useLang'
import { useAuth } from '@/lib/firebase/useAuth'
import { formatPrice } from '@/lib/format'

interface DevSandboxPaymentWidgetProps {
  orderId: string
  offerTitle: string
  amount: number
  onBack: () => void
}

type Outcome = 'approve' | 'decline'

// Local development only: shown instead of TranzilaPaymentWidget when
// /api/payments/initiate reports a sandbox order (lib/payments/devSandbox.ts).
// The server settles the order through the webhook's own transaction, then
// the success page reads the result from Firestore as it would after Tranzila.
export default function DevSandboxPaymentWidget({ orderId, offerTitle, amount, onBack }: DevSandboxPaymentWidgetProps) {
  const { t } = useLang()
  const { user } = useAuth()
  const router = useRouter()
  const [pending, setPending] = useState<Outcome | null>(null)
  const [error, setError] = useState<string | null>(null)

  const simulate = async (outcome: Outcome) => {
    if (!user || pending) return
    setError(null)
    setPending(outcome)
    try {
      const res = await fetch('/api/payments/dev-sandbox', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${await user.getIdToken()}` },
        body: JSON.stringify({ orderId, outcome }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError(data.error ?? t('checkout_error_generic'))
        setPending(null)
        return
      }
      router.push(`/checkout/success?orderId=${encodeURIComponent(orderId)}`)
    } catch {
      setError(t('checkout_error_generic'))
      setPending(null)
    }
  }

  const buttonBase = 'tap-target min-h-12 w-full inline-flex items-center justify-center gap-2 font-bold py-3 rounded-full transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:opacity-60'

  return (
    <div className="bg-white border border-slate-100 rounded-2xl p-6 sm:p-8 shadow-sm text-center pb-[calc(1.5rem+env(safe-area-inset-bottom))] sm:pb-8">
      <p className="inline-flex items-center gap-2 rounded-full bg-amber-100 text-amber-900 text-xs font-bold px-3 py-1 mb-4">
        <i className="fa-solid fa-flask" aria-hidden="true"></i>
        <span>{t('checkout_sandbox_badge')}</span>
      </p>
      <h2 className="text-lg font-bold text-slate-900 mb-2">{t('checkout_sandbox_title')}</h2>
      <p className="text-sm text-slate-500 leading-relaxed">{t('checkout_sandbox_sub')}</p>
      <p className="text-sm font-semibold text-slate-700 mt-4">
        <span>{offerTitle}</span> — <span dir="ltr">{formatPrice(amount)}</span>
      </p>

      <div role="status" aria-live="polite" className="text-sm text-slate-500 mt-4 min-h-5">
        {pending && t('checkout_sandbox_processing')}
      </div>
      {error && <p role="alert" className="mt-2 text-sm font-semibold text-red-600">{error}</p>}

      <div className="flex flex-col gap-3 mt-4">
        <button
          type="button"
          onClick={() => simulate('approve')}
          disabled={pending !== null}
          aria-busy={pending === 'approve' || undefined}
          className={`${buttonBase} bg-brand text-white hover:bg-brandDark shadow-md focus-visible:ring-brand`}
        >
          <i className={`fa-solid ${pending === 'approve' ? 'fa-spinner fa-spin' : 'fa-circle-check'}`} aria-hidden="true"></i>
          <span>{t('checkout_sandbox_approve')}</span>
        </button>
        <button
          type="button"
          onClick={() => simulate('decline')}
          disabled={pending !== null}
          aria-busy={pending === 'decline' || undefined}
          className={`${buttonBase} bg-white text-red-700 border border-red-200 hover:bg-red-50 focus-visible:ring-red-500`}
        >
          <i className={`fa-solid ${pending === 'decline' ? 'fa-spinner fa-spin' : 'fa-circle-xmark'}`} aria-hidden="true"></i>
          <span>{t('checkout_sandbox_decline')}</span>
        </button>
      </div>

      <button
        type="button"
        onClick={onBack}
        disabled={pending !== null}
        className="tap-target min-h-12 inline-flex items-center gap-2 text-brand font-bold text-sm hover:underline mt-4 px-4 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 disabled:opacity-60"
      >
        <i className="fa-solid fa-arrow-left text-xs rtl:-scale-x-100" aria-hidden="true"></i>
        <span>{t('checkout_back_to_summary')}</span>
      </button>
    </div>
  )
}

'use client'

import { ArrowLeft, Lock } from 'lucide-react'
import { useLang } from '@/lib/i18n/useLang'
import { formatPrice } from '@/lib/format'

interface TranzilaPaymentWidgetProps {
  offerTitle: string
  amount: number
  onBack: () => void
}

// Placeholder for Tranzila's hosted iframe widget. Once we have Tranzila
// credentials, swap the body below for their iframe embed — the props this
// component takes (offerTitle, amount) are already what the real widget will
// need, so no restructuring of the checkout page should be required. Payment
// confirmation itself never happens client-side even once wired up: the
// voucher is only created after app/api/payments/tranzila-webhook confirms
// payment server-to-server. No third-party script runs beside it: the
// accessibility widget is excluded from /checkout (AccessibilityWidget.tsx).
export default function TranzilaPaymentWidget({ offerTitle, amount, onBack }: TranzilaPaymentWidgetProps) {
  const { t } = useLang()

  return (
    <div className="bg-white border border-slate-100 rounded-2xl p-6 sm:p-8 shadow-card text-center">
      <Lock aria-hidden="true" className="mx-auto mb-4 h-7 w-7 text-brand" strokeWidth={1.75} />
      <h2 className="text-lg font-bold text-slate-900 mb-2">{t('checkout_payment_coming_soon_title')}</h2>
      <p className="text-sm text-slate-500 leading-relaxed mb-1">{t('checkout_payment_coming_soon_sub')}</p>
      <p className="text-sm font-semibold text-slate-700 mt-4">
        <span>{offerTitle}</span> — <span dir="ltr">{formatPrice(amount)}</span>
      </p>

      <button
        type="button"
        onClick={onBack}
        className="tap-target inline-flex items-center gap-2 text-brand font-bold text-sm hover:underline mt-6 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
      >
        <ArrowLeft aria-hidden="true" className="h-3.5 w-3.5 rtl:-scale-x-100" strokeWidth={2} />
        <span>{t('checkout_back_to_summary')}</span>
      </button>
    </div>
  )
}

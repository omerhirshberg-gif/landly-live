'use client'

import { useLang } from '@/lib/i18n/useLang'
import { formatPrice, PlanDefinition } from '@/lib/plans'

interface TranzilaPaymentWidgetProps {
  plan: PlanDefinition
  amount: number
  onBack: () => void
}

// Placeholder for Tranzila's hosted iframe widget. Once we have Tranzila
// credentials, swap the body below for their iframe embed — the props this
// component takes (plan, amount) are already what the real widget will need,
// so no restructuring of the checkout page should be required.
export default function TranzilaPaymentWidget({ plan, amount, onBack }: TranzilaPaymentWidgetProps) {
  const { t } = useLang()

  return (
    <div className="bg-white border border-slate-100 rounded-2xl p-6 sm:p-8 shadow-sm text-center">
      <i className="fa-solid fa-lock text-brand text-2xl mb-4"></i>
      <h2 className="text-lg font-bold text-slate-900 mb-2">{t('checkout_payment_coming_soon_title')}</h2>
      <p className="text-sm text-slate-500 leading-relaxed mb-1">{t('checkout_payment_coming_soon_sub')}</p>
      <p className="text-sm font-semibold text-slate-700 mt-4" dir="ltr">{t(plan.nameKey)} — {formatPrice(amount, plan.currency)}</p>

      <button onClick={onBack} className="tap-target inline-flex items-center gap-2 text-brand font-bold text-sm hover:underline mt-6">
        <i className="fa-solid fa-arrow-left text-xs"></i>
        <span>{t('checkout_back_to_summary')}</span>
      </button>
    </div>
  )
}

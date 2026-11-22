'use client'

import { Check } from 'lucide-react'
import { useLang } from '@/lib/i18n/useLang'

type Step = 'summary' | 'payment' | 'done'

// The three stops of a purchase, drawn on desktop only (from 1024px): phones
// keep the plain heading. Decorative progress, so the current stop carries
// aria-current and the finished ones a tick.
export default function CheckoutSteps({ current, className = '' }: { current: Step; className?: string }) {
  const { t } = useLang()
  const steps: { id: Step; label: string }[] = [
    { id: 'summary', label: t('checkout_title') },
    { id: 'payment', label: t('checkout_step_payment') },
    { id: 'done', label: t('checkout_step_done') },
  ]
  const at = steps.findIndex((s) => s.id === current)

  return (
    <ol className={`hidden items-center gap-3 lg:flex ${className}`}>
      {steps.map((s, i) => {
        const done = i < at || current === 'done'
        const active = i === at && current !== 'done'
        return (
          <li key={s.id} aria-current={active ? 'step' : undefined} className="flex items-center gap-3">
            {i > 0 && <span aria-hidden="true" className={`h-px w-10 ${i <= at ? 'bg-brand/50' : 'bg-slate-300/70'}`} />}
            <span
              className={`inline-flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ring-1 ${
                done ? 'bg-emerald-500 text-white ring-emerald-500' : active ? 'bg-brand text-white ring-brand' : 'bg-white text-slate-500 ring-slate-300'
              }`}
            >
              {done ? <Check aria-hidden="true" className="h-3.5 w-3.5" strokeWidth={2.5} /> : i + 1}
            </span>
            <span className={`text-sm font-semibold ${active || done ? 'text-ink' : 'text-slate-500'}`}>{s.label}</span>
          </li>
        )
      })}
    </ol>
  )
}

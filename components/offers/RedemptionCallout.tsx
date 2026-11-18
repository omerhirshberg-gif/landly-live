'use client'

import { CalendarCheck, PhoneCall } from 'lucide-react'
import { useLang } from '@/lib/i18n/useLang'
import { isolateNumbers, needsAdvanceNotice } from '@/lib/inventory/raayonitRedemption'
import { REDEMPTION_METHOD_LABEL_KEYS, instructionSteps, type RedemptionMethod } from '@/lib/offers/redemption'

// What the buyer must do before paying, right in the offer's summary: book through Raayonit, book a time, or order by phone.
// Plain and neutral: one icon, the method, the key lines of the merchant's own instructions. Expo: landly-mobile/src/components/RedemptionCallout.tsx.
export default function RedemptionCallout({ method, instructions, instructionsLang, className = '' }: { method: RedemptionMethod; instructions: string; instructionsLang?: string | null; className?: string }) {
  const { t } = useLang()
  if (!needsAdvanceNotice(method)) return null
  const steps = instructionSteps(instructions)
  const lines = steps.length > 0 ? [steps[0]!, ...steps.slice(1).filter((s) => /%/.test(s))] : []
  const Icon = method === 'phone_order' ? PhoneCall : CalendarCheck
  return (
    <div role="note" className={`flex items-start gap-3 rounded-2xl border border-slate-200/80 bg-slate-50/80 p-3.5 ${className}`}>
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brandTint text-brand">
        <Icon aria-hidden="true" className="h-[18px] w-[18px]" strokeWidth={1.75} />
      </span>
      <div className="min-w-0 flex-1 space-y-1">
        <p className="text-sm font-bold leading-snug text-ink">{t(REDEMPTION_METHOD_LABEL_KEYS[method])}</p>
        {lines.map((line, i) => (
          <p key={i} className="text-sm leading-relaxed text-body" lang={instructionsLang ?? undefined} dir="auto">{isolateNumbers(line)}</p>
        ))}
      </div>
    </div>
  )
}

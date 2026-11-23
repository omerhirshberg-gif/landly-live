'use client'

import { Clock } from 'lucide-react'
import { useLang } from '@/lib/i18n/useLang'

/**
 * Raayonit launch-pending notice (native: landly-mobile/src/components/ComingSoonNotice.tsx). Shown wherever the card could be
 * bought while `comingSoon` is on: the card, every value and every business stay visible, only the purchase waits.
 */
export default function ComingSoonNotice({ className = '', compact = false }: { className?: string; compact?: boolean }) {
  const { t } = useLang()
  return (
    <div role="status" className={`flex items-center gap-3 rounded-2xl border border-blue-200/70 bg-gradient-to-br from-blue-50/70 to-indigo-50/30 p-3.5 shadow-[0_8px_30px_rgb(0,0,0,0.04)] backdrop-blur-md ${className}`}>
      <span aria-hidden="true" className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-blue-200/70 bg-white text-brand">
        <Clock className="h-[18px] w-[18px]" strokeWidth={1.75} />
      </span>
      <div className="min-w-0 flex-1 text-start">
        <p className="text-[14px] font-extrabold leading-5 tracking-tight text-ink">{t('raayonit_coming_soon_title')}</p>
        {!compact && <p className="mt-0.5 text-[13px] leading-5 text-body">{t('raayonit_coming_soon_body')}</p>}
      </div>
    </div>
  )
}

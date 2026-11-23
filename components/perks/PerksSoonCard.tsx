'use client'

import { Gift } from 'lucide-react'
import { useLang } from '@/lib/i18n/useLang'

// The calm note for a catalogue with no direct GoLandly perks yet, on Home and Explore Perks (native: landly-mobile/src/components/PerksSoonCard.tsx):
// a soft layered card, a round 40px badge with one line icon, a headline and one sentence. No pill, no button.
export default function PerksSoonCard({ className = '', quiet = false }: { className?: string; /** The live Raayonit chains lead the page, so the note shrinks to plain text with no card or badge. */ quiet?: boolean }) {
  const { t } = useLang()
  if (quiet) {
    return (
      <div aria-live="polite" className={className}>
        <h2 className="text-[15px] font-bold leading-snug text-ink">{t('perks_landly_soon')}</h2>
        <p className="mt-0.5 text-sm leading-5 text-body">{t('perks_soon_sub')}</p>
      </div>
    )
  }
  return (
    <div aria-live="polite" className={`flex items-center gap-3.5 rounded-3xl border border-slate-200/80 bg-white/80 p-4 shadow-[0_8px_30px_rgb(0,0,0,0.04)] backdrop-blur-md sm:gap-4 sm:p-5 ${className}`}>
      <span aria-hidden="true" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-blue-100 bg-gradient-to-br from-blue-50 to-indigo-50/60 text-brand">
        <Gift className="h-5 w-5" strokeWidth={1.75} />
      </span>
      <div className="min-w-0">
        <h2 className="text-base font-bold leading-snug tracking-tight text-ink">{t('perks_landly_soon')}</h2>
        <p className="mt-0.5 text-sm leading-5 text-body">{t('perks_soon_sub')}</p>
      </div>
    </div>
  )
}

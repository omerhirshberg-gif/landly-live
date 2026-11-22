'use client'

import type { PerkSource } from '@/lib/perks/perksFilter'
import { useLang } from '@/lib/i18n/useLang'

// Explore Perks' source switch (native: landly-mobile/src/components/SourceSegment.tsx): All, GoLandly's own perks, Raayonit's chains.
// It lives in the URL (?src=), so a shared link opens on the same segment. A soft grey track with a white raised pill, as on the app.
export default function SourceSegment({ value, onChange }: { value: PerkSource; onChange: (next: PerkSource) => void }) {
  const { t } = useLang()
  const options: { value: PerkSource; label: string }[] = [
    { value: 'all', label: t('perks_src_all') },
    { value: 'landly', label: t('perks_src_landly') },
    { value: 'raayonit', label: t('perks_src_raayonit') },
  ]
  return (
    <div role="tablist" aria-label={t('perks_src_label')} className="mb-6 grid w-full grid-cols-3 gap-1 rounded-2xl bg-slate-100 p-1 sm:inline-grid sm:w-auto sm:min-w-[440px]">
      {options.map((o) => {
        const active = o.value === value
        return (
          <button
            key={o.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(o.value)}
            className={`min-h-11 min-w-0 rounded-xl px-2 py-1.5 text-[13px] font-bold leading-[1.15] sm:px-3 sm:text-[14px] transition-all duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand ${active ? 'bg-white text-brand shadow-[0_2px_8px_rgb(0,0,0,0.08)]' : 'text-body hover:text-ink'}`}
          >
            <bdi dir="auto" className="line-clamp-2 break-words">{o.label}</bdi>
          </button>
        )
      })}
    </div>
  )
}

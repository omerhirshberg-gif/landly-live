'use client'

import { X } from 'lucide-react'
import { useLang } from '@/lib/i18n/useLang'
import { cityLabel, ISRAEL_REGIONS } from '@/lib/israelCities'
import { RADII_KM, type LocationFilter, type RadiusKm } from '@/lib/perks/locationFilter'

type Area = Extract<LocationFilter, { kind: 'area' }>

export function areaName(filter: Area, lang: Parameters<typeof cityLabel>[1]): string {
  if (filter.city) return cityLabel(filter.city, lang)
  return ISRAEL_REGIONS.find((r) => r.id === filter.region)?.names[lang] ?? ''
}

const PILL = 'inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-[13px] font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand'

// Under the search row once a location is in play: "Near me" with 5 / 15 / 25 km pills, or the picked area as a chip, and a clear action (choosing the area lives in the Filter menu, PerksFilterMenu).
// Expo: landly-mobile/src/components/LocationFilterBar.tsx.
export default function LocationFilterBar({ filter, onRadius, onClear, className = '' }: {
  filter: LocationFilter | null
  onRadius: (km: RadiusKm) => void
  onClear: () => void
  className?: string
}) {
  const { t, lang } = useLang()
  if (!filter) return null
  return (
    <div className={`relative ${className}`}>
      <div role="toolbar" className="flex flex-wrap items-center gap-2">
        {filter?.kind === 'gps' && RADII_KM.map((km) => (
          <button key={km} type="button" aria-pressed={filter.radiusKm === km} aria-label={`${t('loc_radius_label')} ${km}`} onClick={() => onRadius(km)} className={`${PILL} ${filter.radiusKm === km ? 'border-brand bg-brand text-white' : 'border-slate-200 bg-white text-ink hover:border-slate-300'}`}>
            <bdi dir="ltr">{km} {lang === 'he' ? 'ק״מ' : lang === 'ru' ? 'км' : 'km'}</bdi>
          </button>
        ))}
        {filter?.kind === 'area' && <span className={`${PILL} border-brand bg-brand text-white`}>{t('loc_in_area').replace('{name}', areaName(filter, lang))}</span>}
        {filter && (
          <button type="button" onClick={onClear} className={`${PILL} border-slate-200 bg-white text-muted hover:border-slate-300`}>
            <X aria-hidden="true" className="h-3.5 w-3.5" strokeWidth={2} />
            {t('loc_clear')}
          </button>
        )}
      </div>
    </div>
  )
}

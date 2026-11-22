'use client'

import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Check, LocateFixed, MapPin, Search, X } from 'lucide-react'
import { useLang } from '@/lib/i18n/useLang'
import { citiesOfRegion, cityLabel, ISRAEL_REGIONS } from '@/lib/israelCities'
import { useBodyScrollLock } from '@/lib/useBodyScrollLock'
import { useGeolocation, type GeoStatus } from '@/lib/useGeolocation'
import { useIsSheet } from '@/lib/useIsSheet'
import { DEFAULT_RADIUS_KM, RADII_KM, type LocationFilter, type RadiusKm } from '@/lib/perks/locationFilter'
import { usePerksSearch } from '@/lib/perks/PerksSearchProvider'
import type { Coordinates } from '@/lib/geo'
import type { TranslationKey } from '@/lib/i18n/translations'

type Area = Extract<LocationFilter, { kind: 'area' }>
interface Draft { coords: Coordinates | null; radiusKm: RadiusKm; area: Area | null }

const GEO_MESSAGES: Partial<Record<GeoStatus, TranslationKey>> = { denied: 'geo_denied', unavailable: 'geo_off', timeout: 'geo_timeout', unsupported: 'geo_unsupported' }
const EMPTY: Draft = { coords: null, radiusKm: DEFAULT_RADIUS_KM, area: null }
const draftOf = (filter: LocationFilter | null): Draft =>
  filter?.kind === 'gps' ? { coords: filter.coords, radiusKm: filter.radiusKm, area: null } : { ...EMPTY, area: filter }

// The location button at the end of the search row (every discovery page): a tinted circle, solid brand while a location is
// applied. From 768px it opens a popover under its end edge; on phones the same content rises as a bottom sheet. Near me
// with its 5 / 15 / 25 km pills, or a region or a searched city, kept as a draft until the sticky footer's Apply commits it
// to the shared filter (lib/perks/PerksSearchProvider.tsx); Reset clears the draft. Expo: landly-mobile/src/components/LocationSheet.tsx.
export default function LocationSheet() {
  const { t, lang } = useLang()
  const { filter, setOrigin, setAreaPick, setRadiusKm } = usePerksSearch()
  const geo = useGeolocation()
  const isSheet = useIsSheet()
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState<Draft>(EMPTY)
  const [query, setQuery] = useState('')
  const triggerRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const panelId = useId()
  const titleId = useId()

  const openSheet = () => { setDraft(draftOf(filter)); setQuery(''); geo.reset(); setOpen(true) }
  const close = useCallback((returnFocus = true) => {
    setOpen(false)
    if (returnFocus) triggerRef.current?.focus()
  }, [])

  useEffect(() => {
    if (!open || isSheet) return
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node
      if (!panelRef.current?.contains(target) && !triggerRef.current?.contains(target)) close(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [open, isSheet, close])
  useBodyScrollLock(open && isSheet)

  const requesting = geo.status === 'requesting'
  const nearMe = async () => {
    if (draft.coords) return setDraft((d) => ({ ...d, coords: null }))
    const coords = await geo.locate()
    if (coords) setDraft((d) => ({ ...d, coords, area: null }))
  }
  const pickArea = (area: Area) => setDraft((d) => ({ ...d, coords: null, area }))
  const q = query.trim().toLowerCase()
  const matches = useMemo(() => (q ? citiesOfRegion(null, lang).filter((c) => c.label.toLowerCase().includes(q) || c.he.includes(query.trim())).slice(0, 8) : []), [q, query, lang])
  const apply = () => {
    if (draft.area) { setOrigin(null); setAreaPick(draft.area) }
    else if (draft.coords) { setAreaPick(null); setOrigin({ coords: draft.coords, area: null }); setRadiusKm(draft.radiusKm) }
    else { setOrigin(null); setAreaPick(null) }
    close(false)
  }
  const km = (n: number) => `${n} ${lang === 'he' ? 'ק״מ' : lang === 'ru' ? 'км' : 'km'}`
  const active = !!filter
  const geoMessage = draft.coords ? null : GEO_MESSAGES[geo.status]

  const heading = 'mb-2 text-sm font-bold text-muted'
  const body = (
    <>
      <div className="max-h-[min(70dvh,38rem)] overflow-y-auto overscroll-contain pb-1">
        <section aria-labelledby={`${titleId}-near`} className="py-2">
          <h3 id={`${titleId}-near`} className={heading}>{t('loc_near_me_title')}</h3>
          <button type="button" role="radio" aria-checked={!!draft.coords} onClick={nearMe} disabled={requesting} className="filter-chip filter-chip-sm disabled:opacity-60">
            <LocateFixed aria-hidden="true" className="h-4 w-4" strokeWidth={1.75} />
            {t('geo_near_me_current')}
          </button>
          {draft.coords && (
            <div role="toolbar" className="mt-3 flex flex-wrap gap-2">
              {RADII_KM.map((r) => (
                <button key={r} type="button" aria-pressed={draft.radiusKm === r} aria-label={`${t('loc_radius_label')} ${r}`} onClick={() => setDraft((d) => ({ ...d, radiusKm: r }))} className={`inline-flex min-h-9 items-center rounded-full border px-4 text-[13px] font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand ${draft.radiusKm === r ? 'border-brand bg-brand text-white' : 'border-slate-200 bg-white text-ink hover:border-slate-300'}`}>
                  <bdi dir="ltr">{km(r)}</bdi>
                </button>
              ))}
            </div>
          )}
          {geoMessage && <p role="alert" className="mt-2 text-xs font-semibold text-red-600">{t(geoMessage)}</p>}
        </section>
        <section aria-labelledby={`${titleId}-area`} className="border-t border-slate-100 py-3">
          <h3 id={`${titleId}-area`} className={heading}>{t('loc_choose_region_city')}</h3>
          <div role="radiogroup" aria-labelledby={`${titleId}-area`} className="flex flex-wrap gap-2">
            {ISRAEL_REGIONS.map((r) => (
              <button key={r.id} type="button" role="radio" aria-checked={draft.area?.region === r.id && !draft.area.city} onClick={() => pickArea({ kind: 'area', region: r.id, city: null })} className="filter-chip filter-chip-sm">
                <MapPin aria-hidden="true" className="h-3.5 w-3.5" strokeWidth={1.75} />
                {r.names[lang]}
              </button>
            ))}
          </div>
          <label className="mt-3 flex min-h-11 items-center gap-2 rounded-xl bg-slate-100 px-3">
            <Search aria-hidden="true" className="h-4 w-4 shrink-0 text-slate-400" strokeWidth={2} />
            {/* 16px text so iOS Safari doesn't zoom into it. */}
            <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t('loc_city_search')} aria-label={t('loc_city_search')} className="min-w-0 flex-1 bg-transparent text-base text-ink outline-none placeholder:text-slate-400" />
          </label>
          {draft.area?.city && !q && (
            <p className="mt-2 flex items-center gap-1.5 text-sm font-bold text-brand"><Check aria-hidden="true" className="h-4 w-4" strokeWidth={2.4} />{cityLabel(draft.area.city, lang)}</p>
          )}
          {q && (
            <ul className="mt-2 divide-y divide-slate-100">
              {matches.length === 0 && <li className="py-3 text-sm text-muted">{t('loc_no_cities')}</li>}
              {matches.map((c) => (
                <li key={c.he}>
                  <button type="button" onClick={() => { pickArea({ kind: 'area', region: null, city: c.he }); setQuery('') }} className="flex min-h-11 w-full items-center justify-between text-start text-[15px] font-medium text-ink [@media(hover:hover)]:hover:text-brand">
                    {c.label}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
      <div className="mt-2 flex items-center justify-between gap-3 border-t border-slate-100 pt-3">
        <button type="button" onClick={() => { setDraft(EMPTY); geo.reset() }} className="min-h-11 rounded-xl px-4 text-sm font-semibold text-slate-600 transition-colors [@media(hover:hover)]:hover:bg-slate-100">
          {t('loc_reset')}
        </button>
        <button type="button" onClick={apply} className="ds-btn ds-btn-primary min-h-11 flex-1 rounded-xl px-6 text-sm sm:flex-none">
          {t('loc_apply')}
        </button>
      </div>
    </>
  )
  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Escape') { event.preventDefault(); close() }
  }

  return (
    <div className="relative flex-shrink-0">
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        aria-pressed={active}
        aria-label={t('geo_near_me_btn')}
        onClick={() => (open ? close() : openSheet())}
        className={`tap-target inline-flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full border [-webkit-tap-highlight-color:transparent] transition-colors duration-150 motion-reduce:transition-none ${
          active ? 'border-brand bg-brand text-white shadow-btn-primary [@media(hover:hover)]:hover:bg-brandDark' : 'border-slate-200/90 bg-white text-ink shadow-sm [@media(hover:hover)]:hover:bg-slate-50'
        }`}
      >
        <LocateFixed aria-hidden="true" className="h-[18px] w-[18px]" strokeWidth={1.75} />
      </button>

      {open && !isSheet && (
        <div ref={panelRef} id={panelId} role="dialog" aria-labelledby={titleId} onKeyDown={onKeyDown} className="perks-pop absolute end-0 top-[calc(100%+8px)] z-40 w-[360px] origin-top-right rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_12px_36px_rgba(15,23,42,.14)] rtl:origin-top-left">
          <h2 id={titleId} className="mb-1 text-base font-bold text-ink">{t('loc_sheet_title')}</h2>
          {body}
        </div>
      )}
      {open && isSheet && createPortal(
        <div className="fixed inset-0 z-[70]">
          <div aria-hidden="true" onClick={() => close()} className="perks-scrim absolute inset-0 bg-ink/30" />
          <div ref={panelRef} id={panelId} role="dialog" aria-modal="true" aria-labelledby={titleId} onKeyDown={onKeyDown} className="perks-sheet absolute inset-x-0 bottom-0 max-h-[88dvh] overflow-hidden rounded-t-3xl bg-white px-4 pt-2 pb-[max(16px,env(safe-area-inset-bottom))]">
            <div aria-hidden="true" className="mx-auto mb-2 h-1 w-9 rounded-full bg-slate-300" />
            <div className="flex items-center justify-between pb-1">
              <h2 id={titleId} className="text-base font-bold text-ink">{t('loc_sheet_title')}</h2>
              <button type="button" onClick={() => close()} aria-label={t('loc_back')} className="flex h-11 w-11 items-center justify-center rounded-full text-slate-500 [@media(hover:hover)]:hover:bg-slate-100">
                <X aria-hidden="true" className="h-5 w-5" strokeWidth={2} />
              </button>
            </div>
            {body}
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}

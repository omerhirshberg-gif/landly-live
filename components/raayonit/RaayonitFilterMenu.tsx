'use client'

import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Check, MapPin, Navigation, SlidersHorizontal, X } from 'lucide-react'
import { useLang } from '@/lib/i18n/useLang'
import { useBodyScrollLock } from '@/lib/useBodyScrollLock'
import { useIsSheet } from '@/lib/useIsSheet'
import type { RaayonitCategoryId } from '@/lib/offers/raayonitCategories'
import type { Coordinates } from '@/lib/geo'
import { RAAYONIT_REGION_LABEL_KEYS, type RaayonitRegionFilter } from '@/lib/offers/raayonitRegions'
import { useGeolocation, type GeoStatus } from '@/lib/useGeolocation'
import type { TranslationKey } from '@/lib/i18n/translations'

export interface RaayonitFilterValues {
  category: RaayonitCategoryId | 'all'
  region: RaayonitRegionFilter
  /** "Near me": the member's position, which limits the hub to venues within 5 km (nearest first). Replaces the region. */
  near: Coordinates | null
}
export const NO_RAAYONIT_FILTERS: RaayonitFilterValues = { category: 'all', region: 'all', near: null }
export const raayonitFilterCount = (v: RaayonitFilterValues): number => Number(v.category !== 'all') + Number(v.region !== 'all' || !!v.near)
/** Which group a button holds: the Filter button has the categories, the Location button the regions. */
export type RaayonitFilterMode = 'category' | 'region'

// The Raayonit hub's "Filter" button beside the search field (native: landly-mobile/src/components/RaayonitFilterSheet.tsx): a count badge
// when filters are on, and one panel with two groups, Category and Region, as selectable tiles. From 768px it is a popover under the
// button's end edge; on phones the same panel rises as a bottom sheet. The picks are a draft until "Apply"; "Reset" clears the draft.
const GEO_MESSAGES: Partial<Record<GeoStatus, TranslationKey>> = { denied: 'geo_denied', unavailable: 'geo_off', timeout: 'geo_timeout', unsupported: 'geo_unsupported' }

export default function RaayonitFilterMenu({
  values,
  onApply,
  categories,
  regions,
  mode = 'category',
}: {
  values: RaayonitFilterValues
  onApply: (next: RaayonitFilterValues) => void
  categories: { id: RaayonitCategoryId; label: string }[]
  regions: RaayonitRegionFilter[]
  mode?: RaayonitFilterMode
}) {
  const { t } = useLang()
  const label = t(mode === 'region' ? 'raayonit_location_btn' : 'raayonit_filter_btn')
  const Icon = mode === 'region' ? MapPin : SlidersHorizontal
  const isSheet = useIsSheet()
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState<RaayonitFilterValues>(values)
  const geo = useGeolocation()
  const nearMe = async () => {
    // The button itself turns location on and applies: the hub shows the venues within 5 km, nearest first.
    const coords = await geo.locate()
    if (coords) { onApply({ ...values, region: 'all', near: coords }); close(false) }
  }
  const triggerRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const panelId = useId()
  const titleId = useId()
  const count = mode === 'region' ? Number(values.region !== 'all' || !!values.near) : Number(values.category !== 'all')

  const close = useCallback((returnFocus = true) => {
    setOpen(false)
    if (returnFocus) triggerRef.current?.focus()
  }, [])
  const openMenu = () => { setDraft(values); setOpen(true) }

  useEffect(() => {
    if (!open) return
    panelRef.current?.querySelector<HTMLButtonElement>('[aria-checked="true"]')?.focus()
  }, [open, isSheet])

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

  const tile = (key: string, label: string, selected: boolean, onPick: () => void) => (
    <button key={key} type="button" role="radio" aria-checked={selected} onClick={onPick}
      className={`flex min-h-12 items-center justify-between gap-2 rounded-xl border px-3 py-2 text-start text-sm transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand ${selected ? 'border-brand bg-brandTint font-bold text-brand' : 'border-slate-200 bg-white font-medium text-ink [@media(hover:hover)]:hover:border-slate-300'}`}>
      <bdi dir="auto" className="min-w-0 flex-1 leading-snug">{label}</bdi>
      {selected && <Check aria-hidden="true" className="h-4 w-4 shrink-0" strokeWidth={2.4} />}
    </button>
  )
  const body = (
    <>
      <div className="max-h-[min(68dvh,560px)] overflow-y-auto pe-1">
        {mode === 'category' && <div role="radiogroup" aria-label={t('filter_category')} className="py-2">
          <div className="mb-2 text-sm font-bold text-ink">{t('filter_category')}</div>
          <div className="grid grid-cols-2 gap-2">
            {tile('all', t('raayonit_filter_all'), draft.category === 'all', () => setDraft((d) => ({ ...d, category: 'all' })))}
            {categories.map((c) => tile(c.id, c.label, draft.category === c.id, () => setDraft((d) => ({ ...d, category: c.id }))))}
          </div>
        </div>}
        {mode === 'region' && regions.length > 1 && (
          <div role="radiogroup" aria-label={t('raayonit_region_label')} className="py-2">
            <div className="mb-2 text-sm font-bold text-ink">{t('raayonit_region_label')}</div>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={nearMe} disabled={geo.status === 'requesting'}
                className="col-span-2 flex min-h-12 items-center gap-2 rounded-xl border border-dashed border-brand/50 bg-brandTint px-3 py-2 text-start text-sm font-semibold text-brand transition-colors disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand">
                <Navigation aria-hidden="true" className="h-4 w-4 shrink-0" strokeWidth={1.75} />
                <span className="min-w-0 flex-1">{t('geo_near_me_current')}</span>
                {values.near && <Check aria-hidden="true" className="h-4 w-4 shrink-0" strokeWidth={2.4} />}
              </button>
              {GEO_MESSAGES[geo.status] && <p role="status" className="col-span-2 text-xs text-slate-600">{t(GEO_MESSAGES[geo.status]!)}</p>}
              {regions.map((r) => tile(r, t(RAAYONIT_REGION_LABEL_KEYS[r]), draft.region === r && !draft.near, () => setDraft((d) => ({ ...d, region: r, near: null }))))}
            </div>
          </div>
        )}
      </div>
      <div className="mt-2 flex items-center justify-between gap-3 border-t border-slate-100 pt-3">
        <button type="button" onClick={() => setDraft((d) => (mode === 'region' ? { ...d, region: 'all', near: null } : { ...d, category: 'all' }))} className="min-h-11 rounded-xl px-3 text-sm font-semibold text-slate-600 underline [@media(hover:hover)]:hover:bg-slate-100">
          {t('raayonit_filter_reset')}
        </button>
        <button type="button" onClick={() => { onApply(draft); close(false) }} className="min-h-11 flex-1 rounded-full bg-ink px-6 text-sm font-bold text-white transition-opacity [@media(hover:hover)]:hover:opacity-90 sm:flex-none">
          {t('raayonit_filter_apply')}
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
        aria-label={`${label}${count > 0 ? ` (${count})` : ''}`}
        onClick={() => (open ? close() : openMenu())}
        className={`inline-flex h-11 items-center gap-1.5 rounded-[14px] border bg-white px-3.5 text-sm font-semibold transition-colors [-webkit-tap-highlight-color:transparent] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand ${count > 0 ? 'border-brand text-brand' : 'border-slate-200 text-ink [@media(hover:hover)]:hover:bg-slate-50'}`}
      >
        <Icon aria-hidden="true" className="h-4 w-4" strokeWidth={1.75} />
        <span>{label}</span>
        {count > 0 && <span aria-hidden="true" className="inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-brand px-1 text-[11px] font-bold leading-none text-white"><bdi dir="ltr">{count}</bdi></span>}
      </button>

      {open && !isSheet && (
        <div ref={panelRef} id={panelId} role="dialog" aria-labelledby={titleId} onKeyDown={onKeyDown}
          className="perks-pop absolute end-0 top-[calc(100%+8px)] z-40 w-[400px] origin-top-right rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_12px_36px_rgba(15,23,42,.14)] rtl:origin-top-left">
          <h2 id={titleId} className="sr-only">{label}</h2>
          {body}
        </div>
      )}

      {open && isSheet && createPortal(
        <div className="fixed inset-0 z-[70]">
          <div aria-hidden="true" onClick={() => close()} className="perks-scrim absolute inset-0 bg-ink/30" />
          <div ref={panelRef} id={panelId} role="dialog" aria-modal="true" aria-labelledby={titleId} onKeyDown={onKeyDown}
            className="perks-sheet absolute inset-x-0 bottom-0 max-h-[88dvh] overflow-y-auto rounded-t-3xl bg-white px-4 pt-2 pb-[max(16px,env(safe-area-inset-bottom))]">
            <div aria-hidden="true" className="mx-auto mb-2 h-1 w-9 rounded-full bg-slate-300" />
            <div className="flex items-center justify-between pb-1">
              <h2 id={titleId} className="text-base font-bold text-ink">{label}</h2>
              <button type="button" onClick={() => close()} aria-label={t('avatar_cancel')} className="flex h-11 w-11 items-center justify-center rounded-full text-slate-500 [@media(hover:hover)]:hover:bg-slate-100">
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

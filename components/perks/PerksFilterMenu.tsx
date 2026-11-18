'use client'

import { useCallback, useEffect, useId, useRef, useState, useSyncExternalStore, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { LocateFixed, SlidersHorizontal, X } from 'lucide-react'
import { useLang } from '@/lib/i18n/useLang'
import { useBodyScrollLock } from '@/lib/useBodyScrollLock'
import { useGeolocation, type GeoStatus } from '@/lib/useGeolocation'
import { usePerksSearch } from '@/lib/perks/PerksSearchProvider'
import { citiesOfRegion, ISRAEL_REGIONS } from '@/lib/israelCities'
import {
  DEFAULT_PERK_SORT,
  PERK_METHOD_FILTERS,
  PERK_MIN_DISCOUNTS,
  PERK_SORTS,
  PERK_SORT_LABELS,
  type PerkMethodFilter,
  type PerkMinDiscount,
  type PerkSort,
} from '@/lib/perks/perksFilter'
import type { TranslationKey } from '@/lib/i18n/translations'

const SHEET_QUERY = '(max-width: 767px)'

function useIsSheet(): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const media = window.matchMedia(SHEET_QUERY)
      media.addEventListener('change', onChange)
      return () => media.removeEventListener('change', onChange)
    },
    () => window.matchMedia(SHEET_QUERY).matches,
    () => false
  )
}

const GEO_MESSAGES: Partial<Record<GeoStatus, TranslationKey>> = { denied: 'geo_denied', unavailable: 'geo_off', timeout: 'geo_timeout', unsupported: 'geo_unsupported' }

const METHOD_LABELS: Record<PerkMethodFilter, TranslationKey> = {
  all: 'cats_filter_method_all',
  in_store: 'redeem_method_in_store',
  online: 'redeem_method_online',
}

interface Props {
  sort: PerkSort
  onSortChange: (next: PerkSort) => void
  method: PerkMethodFilter
  onMethodChange: (next: PerkMethodFilter) => void
  minDiscount: PerkMinDiscount
  onMinDiscountChange: (next: PerkMinDiscount) => void
  onReset: () => void
  /** Runs when Done is pressed (off /categories the bar navigates there with the chosen filters). */
  onDone?: () => void
}

// The "Filter" pill beside Near Me on /categories. From 768px it opens a
// popover under the pill's end edge; on phones the same groups rise as a
// bottom sheet. Three single-choice groups (Sort by, Redemption type, Minimum
// discount) of pill radios, applied as they are tapped (they live in the URL),
// with Reset and Done at the foot. The pill fills brand blue and shows how
// many of the three are set. Escape closes and returns focus to the pill.
export default function PerksFilterMenu({ sort, onSortChange, method, onMethodChange, minDiscount, onMinDiscountChange, onReset, onDone }: Props) {
  const { t, lang } = useLang()
  const { filter, setOrigin, setAreaPick } = usePerksSearch()
  const geo = useGeolocation()
  const isSheet = useIsSheet()
  const [open, setOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const panelId = useId()
  const titleId = useId()

  const activeCount = Number(sort !== DEFAULT_PERK_SORT) + Number(method !== 'all') + Number(minDiscount !== 0) + Number(!!filter)
  const clearLocation = () => { geo.reset(); setOrigin(null); setAreaPick(null) }
  const nearMe = async () => {
    if (filter?.kind === 'gps') return clearLocation()
    const coords = await geo.locate()
    if (coords) { setAreaPick(null); setOrigin({ coords, area: null }) }
  }
  const geoMessage = filter ? null : GEO_MESSAGES[geo.status]
  const regionPicked = filter?.kind === 'area' && !filter.city ? filter.region : null
  const cityPicked = filter?.kind === 'area' && filter.city ? filter.city : ''

  const close = useCallback((returnFocus = true) => {
    setOpen(false)
    if (returnFocus) triggerRef.current?.focus()
  }, [])

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

  const group = (label: string, children: ReactNode) => (
    <div role="radiogroup" aria-label={label} className="py-3">
      <div className="mb-2 text-sm font-bold text-ink">{label}</div>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  )
  const pill = (key: string, checked: boolean, onPick: () => void, content: ReactNode) => (
    <button key={key} type="button" role="radio" aria-checked={checked} onClick={onPick} className="filter-chip filter-chip-sm">
      {content}
    </button>
  )

  const body = (
    <>
      <div className="divide-y divide-slate-100">
        {group(
          t('filter_area_title'),
          <>
            {pill('near', filter?.kind === 'gps', nearMe, <><LocateFixed aria-hidden="true" className="h-4 w-4" strokeWidth={1.75} />{t('geo_near_me_current')}</>)}
            {pill('all', !filter, clearLocation, t('loc_all_israel'))}
            {ISRAEL_REGIONS.map((r) => pill(r.id, regionPicked === r.id, () => { geo.reset(); setOrigin(null); setAreaPick({ kind: 'area', region: r.id, city: null }) }, r.names[lang]))}
            <select
              aria-label={t('loc_other_city')}
              value={cityPicked}
              onChange={(e) => { if (e.target.value) { geo.reset(); setOrigin(null); setAreaPick({ kind: 'area', region: null, city: e.target.value }) } }}
              className="min-h-9 max-w-full rounded-full border border-slate-200 bg-white px-3 text-base text-ink sm:text-[13px]"
            >
              <option value="">{t('loc_other_city')}</option>
              {citiesOfRegion(null, lang).map((c) => <option key={c.he} value={c.he}>{c.label}</option>)}
            </select>
            {geoMessage && <p role="alert" className="w-full text-xs font-semibold text-red-600">{t(geoMessage)}</p>}
          </>
        )}
        {group(t('cats_sort_label'), PERK_SORTS.map((value) => pill(value, sort === value, () => onSortChange(value), t(PERK_SORT_LABELS[value]))))}
        {group(t('cats_filter_method'), PERK_METHOD_FILTERS.map((value) => pill(value, method === value, () => onMethodChange(value), t(METHOD_LABELS[value]))))}
        {group(
          t('cats_filter_discount'),
          PERK_MIN_DISCOUNTS.map((value) =>
            pill(String(value), minDiscount === value, () => onMinDiscountChange(value), value === 0 ? t('cats_filter_discount_any') : <bdi dir="ltr">{value}%+</bdi>)
          )
        )}
      </div>
      <div className="mt-2 flex items-center justify-between gap-3 border-t border-slate-100 pt-3">
        <button
          type="button"
          onClick={() => { onReset(); clearLocation() }}
          disabled={activeCount === 0}
          className="min-h-11 rounded-xl px-4 text-sm font-semibold text-slate-600 transition-colors disabled:opacity-40 [@media(hover:hover)]:hover:bg-slate-100"
        >
          {t('cats_filter_reset')}
        </button>
        <button type="button" onClick={() => { close(false); onDone?.() }} className="ds-btn ds-btn-primary min-h-11 rounded-xl px-6 text-sm">
          {t('cats_filter_show')}
        </button>
      </div>
    </>
  )

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Escape') {
      event.preventDefault()
      close()
    }
  }

  return (
    <div className="relative flex-shrink-0">
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        aria-label={t('cats_filter_button')}
        onClick={() => (open ? close() : setOpen(true))}
        data-active={activeCount > 0 || undefined}
        className={`tap-target relative inline-flex h-12 w-12 flex-shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-full border px-0 text-sm font-semibold [-webkit-tap-highlight-color:transparent] transition-colors duration-150 motion-reduce:transition-none sm:w-auto sm:px-5 ${
          activeCount > 0
            ? 'border-brand bg-brand text-white shadow-sm [@media(hover:hover)]:hover:bg-brandDark'
            : 'border-slate-200/90 bg-white text-ink shadow-sm [@media(hover:hover)]:hover:bg-slate-50'
        }`}
      >
        <SlidersHorizontal aria-hidden="true" className="h-[18px] w-[18px] sm:h-4 sm:w-4" strokeWidth={1.75} />
        {/* Hidden, not sr-only: Font Awesome's CDN CSS overrides not-sr-only; the aria-label names the button. */}
        <span className="hidden sm:inline">{t('cats_filter_button')}</span>
        {activeCount > 0 && (
          <span aria-hidden="true" className="absolute -end-1 -top-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full border-2 border-white bg-ink px-1 text-[11px] font-bold tabular-nums leading-none text-white sm:static sm:border-0 sm:bg-white sm:text-xs sm:text-brand">
            <bdi dir="ltr">{activeCount}</bdi>
          </span>
        )}
      </button>

      {open && !isSheet && (
        <div
          ref={panelRef}
          id={panelId}
          role="dialog"
          aria-labelledby={titleId}
          onKeyDown={onKeyDown}
          className="perks-pop absolute end-0 top-[calc(100%+8px)] z-40 w-[360px] origin-top-right rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_12px_36px_rgba(15,23,42,.14)] rtl:origin-top-left"
        >
          <h2 id={titleId} className="sr-only">{t('cats_filter_title')}</h2>
          {body}
        </div>
      )}

      {open &&
        isSheet &&
        createPortal(
          <div className="fixed inset-0 z-[70]">
            <div aria-hidden="true" onClick={() => close()} className="perks-scrim absolute inset-0 bg-ink/30" />
            <div
              ref={panelRef}
              id={panelId}
              role="dialog"
              aria-modal="true"
              aria-labelledby={titleId}
              onKeyDown={onKeyDown}
              className="perks-sheet absolute inset-x-0 bottom-0 max-h-[85dvh] overflow-y-auto rounded-t-3xl bg-white px-4 pt-2 pb-[max(16px,env(safe-area-inset-bottom))]"
            >
              <div aria-hidden="true" className="mx-auto mb-2 h-1 w-9 rounded-full bg-slate-300" />
              <div className="flex items-center justify-between pb-1">
                <h2 id={titleId} className="text-base font-bold text-ink">{t('cats_filter_title')}</h2>
                <button type="button" onClick={() => close()} aria-label={t('cats_filter_show')} className="flex h-11 w-11 items-center justify-center rounded-full text-slate-500 [@media(hover:hover)]:hover:bg-slate-100">
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

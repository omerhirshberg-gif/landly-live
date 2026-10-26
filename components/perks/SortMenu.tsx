'use client'

import { useCallback, useEffect, useId, useRef, useState, useSyncExternalStore, type KeyboardEvent } from 'react'
import { createPortal } from 'react-dom'
import { ArrowDownWideNarrow, Check, ChevronDown } from 'lucide-react'
import { useLang } from '@/lib/i18n/useLang'
import { DEFAULT_PERK_SORT, PERK_SORTS, PERK_SORT_LABELS, type PerkSort } from '@/lib/perks/perksFilter'

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

// The single "⇅ Sort" affordance on /categories (Wolt-style). From 768px it
// opens a small popover under the trigger's end edge; on phones the same
// options rise as a bottom sheet with thumb-height rows. Either way it's a
// menu of radio items: arrows move, Enter/Space picks, Escape closes, and
// focus returns to the trigger. A non-default sort fills the trigger solid
// brand blue (data-active), and from 1024px, where it stands alone in the
// search row as a white outlined pill, also shows its name, so an active
// sort is never hidden.
export default function SortMenu({ value, onChange }: { value: PerkSort; onChange: (next: PerkSort) => void }) {
  const { t } = useLang()
  const isSheet = useIsSheet()
  const [open, setOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const menuId = useId()
  const titleId = useId()

  const close = useCallback((returnFocus = true) => {
    setOpen(false)
    if (returnFocus) triggerRef.current?.focus()
  }, [])

  // Focus the checked option on open.
  useEffect(() => {
    if (!open) return
    menuRef.current?.querySelector<HTMLButtonElement>('[aria-checked="true"]')?.focus()
  }, [open, isSheet])

  // Popover: a press anywhere outside closes it (without stealing focus back).
  useEffect(() => {
    if (!open || isSheet) return
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node
      if (!menuRef.current?.contains(target) && !triggerRef.current?.contains(target)) close(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [open, isSheet, close])

  // Sheet: the page behind doesn't scroll while it's up.
  useEffect(() => {
    if (!open || !isSheet) return
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previous
    }
  }, [open, isSheet])

  const pick = (next: PerkSort) => {
    onChange(next)
    close()
  }

  const onMenuKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const items = Array.from(menuRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitemradio"]') ?? [])
    const index = items.indexOf(document.activeElement as HTMLButtonElement)
    let next = -1
    if (event.key === 'ArrowDown') next = (index + 1) % items.length
    else if (event.key === 'ArrowUp') next = (index - 1 + items.length) % items.length
    else if (event.key === 'Home') next = 0
    else if (event.key === 'End') next = items.length - 1
    else if (event.key === 'Escape') {
      event.preventDefault()
      close()
      return
    } else if (event.key === 'Tab') {
      // The popover closes on Tab; the modal sheet keeps focus inside.
      if (isSheet) event.preventDefault()
      else close(false)
      return
    }
    if (next < 0) return
    event.preventDefault()
    items[next]?.focus()
  }

  const options = PERK_SORTS.map((sort) => {
    const checked = sort === value
    return (
      <button key={sort} type="button" role="menuitemradio" aria-checked={checked} tabIndex={-1} onClick={() => pick(sort)} className="sort-option">
        <span>{t(PERK_SORT_LABELS[sort])}</span>
        {checked && <Check aria-hidden="true" className="h-4 w-4" strokeWidth={2.25} />}
      </button>
    )
  })

  return (
    <div className="relative flex-shrink-0">
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        aria-label={`${t('cats_sort_label')}: ${t(PERK_SORT_LABELS[value])}`}
        onClick={() => (open ? close() : setOpen(true))}
        data-active={value !== DEFAULT_PERK_SORT || undefined}
        className="filter-chip sort-trigger"
      >
        <ArrowDownWideNarrow aria-hidden="true" className="h-4 w-4" strokeWidth={2} />
        {/* Below 1024px the trigger sits pinned beside the chip rail, so it
            always reads a short "Sort" (solid ink when a sort is applied);
            from 1024px there's room for the applied sort's full name. */}
        <span className="lg:hidden">{t('cats_sort_trigger')}</span>
        <span className="hidden lg:inline">{value === DEFAULT_PERK_SORT ? t('cats_sort_trigger') : t(PERK_SORT_LABELS[value])}</span>
        <ChevronDown aria-hidden="true" className="h-3.5 w-3.5 opacity-70" strokeWidth={2} />
      </button>

      {open &&
        !isSheet &&
        // Opens under the trigger's end edge, which mirrors in RTL.
        <div
          ref={menuRef}
          id={menuId}
          role="menu"
          aria-label={t('cats_sort_label')}
          onKeyDown={onMenuKeyDown}
          className="perks-pop absolute end-0 top-[calc(100%+8px)] z-40 w-60 origin-top-right rounded-2xl border border-slate-200 bg-white p-1.5 shadow-[0_12px_36px_rgba(15,23,42,.14)] rtl:origin-top-left"
        >
          {options}
        </div>}

      {open &&
        isSheet &&
        createPortal(
          <div className="fixed inset-0 z-[70]">
            <div aria-hidden="true" onClick={() => close()} className="perks-scrim absolute inset-0 bg-ink/30" />
            <div
              ref={menuRef}
              id={menuId}
              role="dialog"
              aria-modal="true"
              aria-labelledby={titleId}
              onKeyDown={onMenuKeyDown}
              className="perks-sheet absolute inset-x-0 bottom-0 rounded-t-3xl bg-white pl-[calc(0.75rem+env(safe-area-inset-left,0px))] pr-[calc(0.75rem+env(safe-area-inset-right,0px))] pt-2 pb-[max(12px,env(safe-area-inset-bottom))] shadow-[0_-8px_32px_rgba(15,23,42,.12)]"
            >
              <div aria-hidden="true" className="mx-auto mb-2 h-1 w-9 rounded-full bg-slate-300" />
              <h2 id={titleId} className="px-3 pb-2 pt-1 text-base font-bold text-ink">
                {t('cats_sort_label')}
              </h2>
              <div role="menu" aria-labelledby={titleId}>
                {options}
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  )
}

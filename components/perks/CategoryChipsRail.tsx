'use client'

import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { useLang } from '@/lib/i18n/useLang'
import { CATEGORY_TILES } from '@/lib/categories'
import type { CategoryFilter } from '@/lib/perks/perksFilter'

const OPTIONS: { key: CategoryFilter; emoji?: string }[] = [{ key: 'all' }, ...CATEGORY_TILES.map((tile) => ({ key: tile.category, emoji: tile.emoji }))]

// The /categories category filter: "All" plus every category as one
// horizontally scrolling row of single-choice chips (a radiogroup — arrow
// keys move and select, flipped in RTL). Hidden scrollbar, faded edges; the
// browser starts an RTL scroller at its right edge on its own. The selected
// chip is scrolled into view. From 1024px with a mouse, start/end arrow
// buttons beside the track (not over it) page the row; touch keeps swipe.
export default function CategoryChipsRail({ value, onChange }: { value: CategoryFilter; onChange: (next: CategoryFilter) => void }) {
  const { t, isRtl } = useLang()
  const railRef = useRef<HTMLDivElement>(null)
  const chipRefs = useRef(new Map<CategoryFilter, HTMLButtonElement>())
  const [edges, setEdges] = useState({ start: false, end: false })

  const label = (key: CategoryFilter) => {
    if (key === 'all') return t('cats_filter_all')
    const tile = CATEGORY_TILES.find((c) => c.category === key)
    return tile ? t(tile.labelKey) : key
  }

  // scrollLeft runs 0 → negative in RTL, so measure distance from the start edge.
  const measure = useCallback(() => {
    const rail = railRef.current
    if (!rail) return
    const fromStart = Math.abs(rail.scrollLeft)
    const max = rail.scrollWidth - rail.clientWidth
    setEdges({ start: fromStart > 1, end: fromStart < max - 1 })
  }, [])
  // Arrows only exist while the chips overflow; at either end the spent arrow
  // fades out but keeps its place, so the track never shifts under the pointer.
  const overflowing = edges.start || edges.end

  useEffect(() => {
    const rail = railRef.current
    if (!rail) return
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(rail)
    return () => observer.disconnect()
  }, [measure, isRtl])

  // Bring the selected chip into view by scrolling the rail only (never the page).
  useEffect(() => {
    const rail = railRef.current
    const chip = chipRefs.current.get(value)
    if (!rail || !chip) return
    const pad = 16
    const r = rail.getBoundingClientRect()
    const c = chip.getBoundingClientRect()
    const smooth = !window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const delta = c.left < r.left + pad ? c.left - r.left - pad : c.right > r.right - pad ? c.right - r.right + pad : 0
    if (delta) rail.scrollBy({ left: delta, behavior: smooth ? 'smooth' : 'auto' })
  }, [value])

  const page = (direction: 1 | -1) => {
    const rail = railRef.current
    if (!rail) return
    // +1 = toward the reading-direction end.
    rail.scrollBy({ left: direction * rail.clientWidth * 0.7 * (isRtl ? -1 : 1), behavior: 'smooth' })
  }

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    const index = OPTIONS.findIndex((o) => o.key === value)
    const forward = isRtl ? 'ArrowLeft' : 'ArrowRight'
    const back = isRtl ? 'ArrowRight' : 'ArrowLeft'
    let next = -1
    if (event.key === forward) next = Math.min(index + 1, OPTIONS.length - 1)
    else if (event.key === back) next = Math.max(index - 1, 0)
    else if (event.key === 'Home') next = 0
    else if (event.key === 'End') next = OPTIONS.length - 1
    if (next < 0) return
    event.preventDefault()
    const key = OPTIONS[next].key
    onChange(key)
    chipRefs.current.get(key)?.focus()
  }

  return (
    // [ ‹ ] [ chips track ] [ › ]: the arrows are flex siblings of the track,
    // never on top of it, so no chip sits under them. The track bleeds to the
    // screen's start edge on phones only; its end stops at this box.
    <div className="flex min-w-0 items-center gap-2">
      {overflowing && (
        <button
          type="button"
          tabIndex={-1}
          aria-hidden="true"
          onClick={() => page(-1)}
          data-hidden={!edges.start || undefined}
          className="rail-arrow"
        >
          <i className="fa-solid fa-chevron-left rtl:-scale-x-100" aria-hidden="true"></i>
        </button>
      )}
      <div
        ref={railRef}
        role="radiogroup"
        aria-label={t('cats_category_label')}
        onScroll={measure}
        className="rail-track chip-rail-fade scrollbar-none -ms-4 flex min-w-0 flex-1 flex-nowrap gap-2 overflow-x-auto overscroll-x-contain lg:ms-0"
      >
        {OPTIONS.map((option) => {
          const selected = option.key === value
          return (
            <button
              key={option.key}
              ref={(el) => {
                if (el) chipRefs.current.set(option.key, el)
                else chipRefs.current.delete(option.key)
              }}
              type="button"
              role="radio"
              aria-checked={selected}
              tabIndex={selected ? 0 : -1}
              onClick={() => onChange(option.key)}
              onKeyDown={onKeyDown}
              className="filter-chip"
            >
              {option.emoji && <span aria-hidden="true">{option.emoji}</span>}
              <span>{label(option.key)}</span>
            </button>
          )
        })}
      </div>
      {overflowing && (
        <button
          type="button"
          tabIndex={-1}
          aria-hidden="true"
          onClick={() => page(1)}
          data-hidden={!edges.end || undefined}
          className="rail-arrow"
        >
          <i className="fa-solid fa-chevron-right rtl:-scale-x-100" aria-hidden="true"></i>
        </button>
      )}
    </div>
  )
}

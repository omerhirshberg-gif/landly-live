'use client'

import type { ReactNode } from 'react'
import CategoryChipsRail from '@/components/perks/CategoryChipsRail'
import PerksSearchBar from '@/components/perks/PerksSearchBar'
import SortMenu from '@/components/perks/SortMenu'
import type { CategoryFilter, PerkSort } from '@/lib/perks/perksFilter'

interface Props {
  query: string
  onQueryChange: (next: string) => void
  category: CategoryFilter
  onCategoryChange: (next: CategoryFilter) => void
  sort: PerkSort
  onSortChange: (next: PerkSort) => void
  // Action button at the end of the search row (Near Me).
  action?: ReactNode
  // Chips and Sort only belong on a listing; the directory shows search alone.
  showFilters: boolean
}

// The /categories filter bar, two rows on a listing (one grid, so the one
// Sort trigger just changes cell):
//
//   from 1024px   [ search ··················· Near Me ] [ Sort ▾ ]
//                 [ chip rail, full width, arrows inside ········· ]
//
//   below         [ search ············· Near Me ]
//                 [ chip rail ········· ] | [ Sort ]   (thumb reach)
//
// On the directory (nothing chosen) it's the search row alone. The search
// row stays the first child, so the filters appearing never remount the
// input (focus and the phone keyboard survive the first keystroke). Sort
// comes before the rail in the DOM to match the desktop reading order. Grid
// columns follow the writing direction, so in Hebrew search sits on the
// right and Sort on the left.
export default function PerksToolbar({ query, onQueryChange, category, onCategoryChange, sort, onSortChange, action, showFilters }: Props) {
  return (
    <div
      className={
        showFilters
          ? 'grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-y-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:gap-x-3 lg:gap-y-4'
          : 'grid grid-cols-1'
      }
    >
      <div className={`row-start-1 flex max-w-2xl items-center gap-2 ${showFilters ? 'col-span-full lg:col-span-1 lg:max-w-none' : ''}`}>
        <div className="min-w-0 flex-1">
          <PerksSearchBar value={query} onChange={onQueryChange} />
        </div>
        {action}
      </div>
      {showFilters && (
        <>
          <div className="col-start-3 row-start-2 lg:col-start-2 lg:row-start-1">
            <SortMenu value={sort} onChange={onSortChange} />
          </div>
          <div className="col-start-1 row-start-2 min-w-0 lg:col-span-2">
            <CategoryChipsRail value={category} onChange={onCategoryChange} />
          </div>
          <div aria-hidden="true" className="col-start-2 row-start-2 mx-2 h-6 w-px bg-slate-200 lg:hidden" />
        </>
      )}
    </div>
  )
}

'use client'

import { useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import NearMeButton from '@/components/discover/NearMeButton'
import PerksFilterMenu from '@/components/perks/PerksFilterMenu'
import PerksSearchBar from '@/components/perks/PerksSearchBar'
import { usePerksUrlContext } from '@/components/perks/PerksUrlStateContext'
import { usePerksSearch } from '@/lib/perks/PerksSearchProvider'
import { DEFAULT_PERK_SORT, type PerkMethodFilter, type PerkMinDiscount, type PerkSort } from '@/lib/perks/perksFilter'

interface ViewProps {
  query: string
  onQueryChange: (next: string) => void
  /** Enter in the search field. */
  onSubmit?: () => void
  sort: PerkSort
  onSortChange: (next: PerkSort) => void
  method: PerkMethodFilter
  onMethodChange: (next: PerkMethodFilter) => void
  minDiscount: PerkMinDiscount
  onMinDiscountChange: (next: PerkMinDiscount) => void
  onReset: () => void
  /** The filter menu's Done. */
  onFilterDone?: () => void
}

function BarView({ query, onQueryChange, onSubmit, onFilterDone, ...filters }: ViewProps) {
  const { origin, setOrigin, areas, loadAreas } = usePerksSearch()
  const submit = (event: FormEvent) => {
    event.preventDefault()
    onSubmit?.()
  }
  return (
    // The same row, in the same spot, on every discovery and member page: the pill search, Near Me, then Filter.
    <form onSubmit={submit} data-global-search="" className="mx-auto flex w-full max-w-[760px] items-center gap-3">
      <div className="min-w-0 flex-1">
        <PerksSearchBar value={query} onChange={onQueryChange} />
      </div>
      {/* The area picker's offer list is read the first time Near Me is pressed. */}
      <div onClickCapture={loadAreas} className="flex-shrink-0">
        <NearMeButton
          active={!!origin}
          onLocate={(coords) => setOrigin({ coords, area: null })}
          onClear={() => setOrigin(null)}
          areas={areas}
          onChooseArea={(area) => setOrigin({ coords: area.center, area })}
        />
      </div>
      <PerksFilterMenu
        sort={filters.sort}
        onSortChange={filters.onSortChange}
        method={filters.method}
        onMethodChange={filters.onMethodChange}
        minDiscount={filters.minDiscount}
        onMinDiscountChange={filters.onMinDiscountChange}
        onReset={filters.onReset}
        onDone={onFilterDone}
      />
    </form>
  )
}

// On /categories the bar edits the page's own URL state, live. Everywhere else
// (Home, an offer, Wishlist, My Pass, the New and Best Sellers lists) it holds
// a draft and takes the member to /categories with it: Enter in the search, or
// Done in the filter menu.
function NavigatingBar() {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState<PerkSort>(DEFAULT_PERK_SORT)
  const [method, setMethod] = useState<PerkMethodFilter>('all')
  const [minDiscount, setMinDiscount] = useState<PerkMinDiscount>(0)

  const go = () => {
    const params = new URLSearchParams()
    if (query.trim()) params.set('q', query.trim())
    if (sort !== DEFAULT_PERK_SORT) params.set('sort', sort)
    if (method !== 'all') params.set('type', method)
    if (minDiscount !== 0) params.set('min', String(minDiscount))
    const search = params.toString()
    if (search) router.push(`/categories?${search}`)
  }
  const reset = () => {
    setSort(DEFAULT_PERK_SORT)
    setMethod('all')
    setMinDiscount(0)
  }

  return (
    <BarView
      query={query}
      onQueryChange={setQuery}
      onSubmit={go}
      sort={sort}
      onSortChange={setSort}
      method={method}
      onMethodChange={setMethod}
      minDiscount={minDiscount}
      onMinDiscountChange={setMinDiscount}
      onReset={reset}
      onFilterDone={go}
    />
  )
}

export default function GlobalPerkSearchBar() {
  const live = usePerksUrlContext()
  if (!live) return <NavigatingBar />
  return (
    <BarView
      query={live.query}
      onQueryChange={live.setQuery}
      sort={live.sort}
      onSortChange={live.setSort}
      method={live.method}
      onMethodChange={live.setMethod}
      minDiscount={live.minDiscount}
      onMinDiscountChange={live.setMinDiscount}
      onReset={live.resetFilters}
    />
  )
}

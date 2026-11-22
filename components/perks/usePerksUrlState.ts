'use client'

import { useCallback, useEffect, useState } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import { OFFER_KINDS, type OfferKind } from '@/lib/offers/offerKind'
import { DEFAULT_PERK_SORT, parseCategoryFilter, parseMethodFilter, parseMinDiscount, parsePerkSort, parsePerkSource, type CategoryFilter, type PerkMethodFilter, type PerkMinDiscount, type PerkSort, type PerkSource } from '@/lib/perks/perksFilter'
import { useDebouncedValue } from '@/lib/useDebouncedValue'

const SEARCH_DEBOUNCE_MS = 200

// /categories filter state lives in the URL (?cat=&sort=&q=&type=&min=) so a filtered
// view can be shared, reloaded and restored. Writes go through
// history.replaceState, which Next keeps in sync with useSearchParams without
// a navigation or refetch, and never stacks history entries. Defaults are
// left out, so the resting page stays a bare /categories. The typed query is
// local state for instant feedback, written to `q` after a short debounce;
// clearing it writes at once. Needs a <Suspense> boundary above it.
export function usePerksUrlState() {
  const params = useSearchParams()
  const pathname = usePathname()
  const category = parseCategoryFilter(params.get('cat'))
  const sort = parsePerkSort(params.get('sort'))
  const method = parseMethodFilter(params.get('type'))
  const minDiscount = parseMinDiscount(params.get('min'))
  const rawKind = params.get('kind') ?? ''
  const kind: OfferKind | 'all' = (OFFER_KINDS as readonly string[]).includes(rawKind) ? (rawKind as OfferKind) : 'all'
  const brand = (params.get('brand') ?? '').trim()
  const source = parsePerkSource(params.get('src'))
  const urlQuery = params.get('q') ?? ''

  const [query, setQuery] = useState(urlQuery)
  const debouncedQuery = useDebouncedValue(query, SEARCH_DEBOUNCE_MS)
  const appliedQuery = query ? debouncedQuery : ''

  const write = useCallback(
    (key: 'cat' | 'sort' | 'q' | 'type' | 'min' | 'kind' | 'brand' | 'src', value: string | null) => {
      const next = new URLSearchParams(window.location.search)
      if (value) next.set(key, value)
      else next.delete(key)
      const search = next.toString()
      // `null`, never `window.history.state`: Next's patched replaceState
      // treats an entry carrying its own `__NA` marker as internal and skips
      // the useSearchParams sync, which froze the selected chip and results
      // while only the address bar changed. Next copies its internals onto
      // the new entry itself.
      window.history.replaceState(null, '', search ? `${pathname}?${search}` : pathname)
    },
    [pathname]
  )

  useEffect(() => {
    const trimmed = appliedQuery.trim()
    if (trimmed !== urlQuery) write('q', trimmed || null)
  }, [appliedQuery, urlQuery, write])

  const setCategory = useCallback((next: CategoryFilter) => write('cat', next === 'all' ? null : next), [write])
  const setSort = useCallback((next: PerkSort) => write('sort', next === DEFAULT_PERK_SORT ? null : next), [write])

  const setSource = useCallback((next: PerkSource) => write('src', next === 'all' ? null : next), [write])
  const setKind = useCallback((next: OfferKind | 'all') => write('kind', next === 'all' ? null : next), [write])
  const setBrand = useCallback((next: string) => write('brand', next || null), [write])
  const setMethod = useCallback((next: PerkMethodFilter) => write('type', next === 'all' ? null : next), [write])
  const setMinDiscount = useCallback((next: PerkMinDiscount) => write('min', next === 0 ? null : String(next)), [write])
  const reset = useCallback(() => {
    const next = new URLSearchParams(window.location.search)
    for (const key of ['sort', 'type', 'min', 'kind', 'brand']) next.delete(key)
    const search = next.toString()
    window.history.replaceState(null, '', search ? `${pathname}?${search}` : pathname)
  }, [pathname])

  return { query, setQuery, appliedQuery, category, setCategory, sort, setSort, method, setMethod, minDiscount, setMinDiscount, kind, setKind, brand, source, setSource, setBrand, resetFilters: reset }
}

'use client'

import CategoryChipsRail from '@/components/perks/CategoryChipsRail'
import type { CategoryFilter } from '@/lib/perks/perksFilter'

interface Props {
  category: CategoryFilter
  onCategoryChange: (next: CategoryFilter) => void
  // The chips only belong on a listing; the overview shows none.
  showFilters: boolean
}

// The /categories filter row under the persistent search bar
// (components/discover/GlobalPerkSearchBar.tsx, which holds search, Near Me,
// Filter and Sort): on a listing, just the category chip rail, full width.
// Nothing at all on the overview.
export default function PerksToolbar({ category, onCategoryChange, showFilters }: Props) {
  if (!showFilters) return null
  return <CategoryChipsRail value={category} onChange={onCategoryChange} />
}

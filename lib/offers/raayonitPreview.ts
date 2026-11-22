import type { CategoryGroup } from '@/lib/offers/discoverTab'
import type { RaayonitCategoryId } from '@/lib/offers/raayonitCategories'

// The compact Raayonit preview on Home and Perks: the few biggest categories and a short, mixed run of their businesses.
// Pure, shared by the website and the Expo app.

/** The `limit` categories with the most businesses (ties keep Raayonit's own order), still in Raayonit's order. */
export function topCategoryGroups<T>(groups: readonly CategoryGroup<T>[], limit: number): CategoryGroup<T>[] {
  const keep = new Set(
    groups
      .map((g, i) => ({ g, i }))
      .sort((a, b) => b.g.offers.length - a.g.offers.length || a.i - b.i)
      .slice(0, Math.max(0, limit))
      .map((x) => x.g.id),
  )
  return groups.filter((g) => keep.has(g.id))
}

/** `count` businesses: from one chosen category, or (for 'all') taken round-robin across the groups so no category dominates. */
export function previewOffers<T>(groups: readonly CategoryGroup<T>[], active: RaayonitCategoryId | 'all', count: number): T[] {
  if (active !== 'all') return (groups.find((g) => g.id === active)?.offers ?? []).slice(0, count)
  const out: T[] = []
  for (let round = 0; out.length < count; round++) {
    let took = false
    for (const g of groups) {
      if (round < g.offers.length && out.length < count) {
        out.push(g.offers[round])
        took = true
      }
    }
    if (!took) break
  }
  return out
}

/** "230+": the count rounded down to a whole ten, never above the real number. */
export const roundedCount = (n: number): number => (n >= 10 ? Math.floor(n / 10) * 10 : n)

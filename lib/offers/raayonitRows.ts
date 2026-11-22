// The Raayonit hub's category rows (web: components/raayonit/RaayonitTab.tsx, native: landly-mobile/src/components/RaayonitTab.tsx): each
// category shows its first ten businesses in a sideways row, and a "Show all" button opens the full list when there are more. A category
// with only a handful of businesses (one chain's own section, say) would leave a row mostly empty, so those are gathered into one shared
// closing row, "More chains", instead of a row each. Pure.
export const RAAYONIT_ROW_COUNT = 10
/** A category with fewer businesses than this joins the shared closing row. */
export const RAAYONIT_MIN_ROW = 4
export const RAAYONIT_MORE_ROW = 'more'

export interface RaayonitRow<T> { id: string; offers: T[]; total: number; hasMore: boolean; /** The full list a "Show all" opens. */ all: T[] }

export function raayonitRows<T>(groups: readonly { id: string; offers: readonly T[] }[], limit = RAAYONIT_ROW_COUNT, minRow = RAAYONIT_MIN_ROW): RaayonitRow<T>[] {
  const full = groups.filter((g) => g.offers.length >= minRow)
  const small = groups.filter((g) => g.offers.length > 0 && g.offers.length < minRow).flatMap((g) => g.offers)
  // With nothing big to sit under, a lone small group keeps its own row.
  const rows = [...full.map((g) => ({ id: g.id, all: [...g.offers] }))]
  if (small.length > 0) rows.push({ id: full.length === 0 && groups.length === 1 ? groups[0]!.id : RAAYONIT_MORE_ROW, all: [...small] })
  return rows.map((r) => ({ id: r.id, offers: r.all.slice(0, limit), total: r.all.length, hasMore: r.all.length > limit, all: r.all }))
}

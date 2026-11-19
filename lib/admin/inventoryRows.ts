// The Stock & Vouchers table's rows: every perk, Raayonit (a supply of supplier codes, restocked
// from a spreadsheet) and local-business (claims counted against the perk's own cap), in one
// list with one stock-health rule. Pure, so the page and the unit tests share it.

export type InventoryKind = 'raayonit' | 'direct'
export type StockHealth = 'out' | 'low' | 'ok' | 'unlimited'
export type HealthFilter = 'all' | 'low' | 'out'

/** A Raayonit supply with no threshold of its own warns at this many codes or fewer. */
export const DEFAULT_LOW_STOCK = 10

export interface InventoryOffer {
  id: string
  title: string
  businessName: string
  fulfillmentType: 'direct_merchant' | 'raayonit_pool'
  poolId: string | null
  totalQuantity: number | null
  claimedCount: number
}

export interface InventoryPool {
  poolId: string
  /** Only an older one-offer stock has one; a shared stock serves every offer that points at it. */
  offerId: string | null
  title?: string
  faceValueAgorot?: number | null
  priceAgorot?: number | null
  status: 'active' | 'depleted' | 'archived'
  totalPurchased: number
  allocatedCount: number
  remainingCount: number
  warningThreshold: number
}

export interface InventoryRow {
  id: string
  title: string
  businessName: string
  kind: InventoryKind
  /** The supply to restock; null for a local-business perk. */
  poolId: string | null
  /** Codes bought (Raayonit) or the perk's cap (local; null = unlimited). */
  purchased: number | null
  claimed: number
  /** Null when unlimited. */
  remaining: number | null
  threshold: number
  health: StockHealth
  archived: boolean
}

export function stockHealth(remaining: number | null, threshold: number): StockHealth {
  if (remaining === null) return 'unlimited'
  if (remaining <= 0) return 'out'
  return remaining <= threshold ? 'low' : 'ok'
}

const finiteOr = (value: unknown, fallback: number) => (typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : fallback)

export function buildInventoryRows(offers: readonly InventoryOffer[], pools: readonly InventoryPool[]): InventoryRow[] {
  const byOffer = new Map(pools.flatMap((p) => (p.offerId ? [[p.offerId, p] as const] : [])))
  return offers.map((offer): InventoryRow => {
    if (offer.fulfillmentType === 'raayonit_pool') {
      const pool = (offer.poolId ? pools.find((p) => p.poolId === offer.poolId) : undefined) ?? byOffer.get(offer.id)
      const remaining = pool ? Math.max(0, pool.remainingCount) : 0
      const threshold = finiteOr(pool?.warningThreshold, DEFAULT_LOW_STOCK)
      return {
        id: offer.id, title: offer.title, businessName: offer.businessName, kind: 'raayonit', poolId: pool?.poolId ?? offer.poolId,
        purchased: pool?.totalPurchased ?? 0, claimed: pool?.allocatedCount ?? 0, remaining, threshold,
        health: stockHealth(remaining, threshold), archived: pool?.status === 'archived',
      }
    }
    const cap = offer.totalQuantity
    const remaining = cap === null ? null : Math.max(0, cap - offer.claimedCount)
    // A local perk is low in its last tenth.
    const threshold = cap === null ? 0 : Math.floor(cap / 10)
    return {
      id: offer.id, title: offer.title, businessName: offer.businessName, kind: 'direct', poolId: null,
      purchased: cap, claimed: offer.claimedCount, remaining, threshold, health: stockHealth(remaining, threshold), archived: false,
    }
  })
}

const URGENCY: Record<StockHealth, number> = { out: 0, low: 1, ok: 2, unlimited: 3 }

/** Most urgent first (out, then low), then by title. */
export function sortByUrgency(rows: readonly InventoryRow[]): InventoryRow[] {
  return [...rows].sort((a, b) => URGENCY[a.health] - URGENCY[b.health] || a.title.localeCompare(b.title))
}

export function filterInventory(rows: readonly InventoryRow[], { query, health }: { query: string; health: HealthFilter }): InventoryRow[] {
  const q = query.trim().toLowerCase()
  return rows.filter((row) => (health === 'all' || row.health === health) && (!q || row.title.toLowerCase().includes(q) || row.businessName.toLowerCase().includes(q)))
}

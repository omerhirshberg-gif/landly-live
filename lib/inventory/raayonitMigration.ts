// Raayonit cards used to be one offer per (voucher stock x brand), keyed `raayonit:{poolId}:{brandKey}`. They are now one
// offer per brand with a variant per stock, keyed `raayonit:{brandKey}`. This plans the move: per brand, which existing
// offer survives (the new-format one, else the cheapest stock's) and which are retired. Pure, so it is testable.

export interface ExistingCard { id: string; sourceKey: string; faceValueAgorot: number }
export interface MigrationPlan {
  /** brand key -> the offer id that carries the brand from now on. */
  survivors: Map<string, string>
  /** Offers to unpublish and re-key, with the survivor each one points at. */
  retire: { id: string; supersededBy: string }[]
  /** Survivors still on a legacy key, which need their sourceKey rewritten. */
  rekey: { id: string; sourceKey: string }[]
}

export const brandSourceKey = (brandKey: string) => `raayonit:${brandKey}`
const LEGACY = /^raayonit:([^:]+):(.+)$/
const CURRENT = /^raayonit:([^:]+)$/

export function planRaayonitMigration(existing: readonly ExistingCard[]): MigrationPlan {
  const byBrand = new Map<string, { card: ExistingCard; legacy: boolean }[]>()
  for (const card of existing) {
    const legacy = card.sourceKey.match(LEGACY)
    const current = legacy ? null : card.sourceKey.match(CURRENT)
    const brand = legacy?.[2] ?? current?.[1]
    if (!brand) continue
    byBrand.set(brand, [...(byBrand.get(brand) ?? []), { card, legacy: !!legacy }])
  }
  const plan: MigrationPlan = { survivors: new Map(), retire: [], rekey: [] }
  for (const [brand, cards] of byBrand) {
    const ordered = [...cards].sort((a, b) => Number(a.legacy) - Number(b.legacy) || a.card.faceValueAgorot - b.card.faceValueAgorot || a.card.id.localeCompare(b.card.id))
    const survivor = ordered[0]!
    plan.survivors.set(brand, survivor.card.id)
    if (survivor.legacy) plan.rekey.push({ id: survivor.card.id, sourceKey: brandSourceKey(brand) })
    for (const other of ordered.slice(1)) plan.retire.push({ id: other.card.id, supersededBy: survivor.card.id })
  }
  return plan
}

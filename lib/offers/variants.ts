// A multi-denomination offer (Raayonit's "תו על"): one card per brand, one purchasable variant per voucher stock.
// The top-level offer fields stay the default (first) variant, so every consumer that knows nothing of variants keeps working.

export interface OfferVariant {
  faceValueAgorot: number
  priceAgorot: number
  poolId: string
}

const isPositiveInt = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v) && v > 0

/** Reads a stored `variants` array: valid entries only, sorted by face value, no duplicate pools. */
export function parseVariants(value: unknown): OfferVariant[] {
  if (!Array.isArray(value)) return []
  const seen = new Set<string>()
  const out: OfferVariant[] = []
  for (const raw of value) {
    const v = raw as Partial<OfferVariant> | null
    if (!v || !isPositiveInt(v.faceValueAgorot) || !isPositiveInt(v.priceAgorot) || typeof v.poolId !== 'string' || !v.poolId || seen.has(v.poolId)) continue
    seen.add(v.poolId)
    out.push({ faceValueAgorot: v.faceValueAgorot, priceAgorot: v.priceAgorot, poolId: v.poolId })
  }
  return out.sort((a, b) => a.faceValueAgorot - b.faceValueAgorot)
}

/** The variant a checkout asked for, or null when the offer has none or the pool isn't one of them. */
export function findVariant(variants: readonly OfferVariant[], poolId: unknown): OfferVariant | null {
  return typeof poolId === 'string' ? variants.find((v) => v.poolId === poolId) ?? null : null
}

/** An order (and its voucher) id: legacy `${uid}_${offerId}` without a variant, `${uid}_${offerId}_${poolId}` with one. */
export const orderIdFor = (uid: string, offerId: string, variantPoolId?: string | null) =>
  variantPoolId ? `${uid}_${offerId}_${variantPoolId}` : `${uid}_${offerId}`

/** True when `orderId` is the id this order's member, offer and pool call for (either form). */
export function orderIdMatches(orderId: string, order: { userId?: unknown; offerId?: unknown; poolId?: unknown; variant?: unknown }): boolean {
  if (typeof order.userId !== 'string' || typeof order.offerId !== 'string') return false
  if (orderId === orderIdFor(order.userId, order.offerId)) return true
  return order.variant === true && typeof order.poolId === 'string' && orderId === orderIdFor(order.userId, order.offerId, order.poolId)
}

/** The cheapest variant, for "From ₪89"; null for a single-denomination offer. */
export const startingVariant = (variants: readonly OfferVariant[]): OfferVariant | null =>
  variants.length > 1 ? [...variants].sort((a, b) => a.priceAgorot - b.priceAgorot)[0] : null

export const variantDiscountPercent = (v: OfferVariant) => Math.round((1 - v.priceAgorot / v.faceValueAgorot) * 100)

// What the public catalogue may show. An offer is listed only while it is published, unexpired, not sold out, belongs to a
// business that still exists and is not suspended, and (a Raayonit offer) has voucher stock in at least one value. Pure: the
// cache route feeds it the raw documents plus the pool and business facts it read, and the tests drive it directly.
import { isOfferActive } from '@/lib/admin/offerStatus'
import { parseVariants, type OfferVariant } from './variants'
import type { BrandIndexEntry } from './branches'
import { relocateBundledImage } from './imageUrl'

export interface AvailabilityContext {
  /** Remaining voucher codes per pool id. A pool that isn't listed is treated as empty. */
  poolRemaining: ReadonlyMap<string, number>
  /** Business ids that exist and may trade; null when businesses were not read. */
  activeBusinesses: ReadonlySet<string> | null
  now?: number
}

const toMillis = (v: unknown): number | null => {
  if (!v) return null
  if (v instanceof Date) return v.getTime()
  const t = v as { toMillis?: () => number; toDate?: () => Date }
  if (typeof t.toMillis === 'function') return t.toMillis()
  return typeof t.toDate === 'function' ? t.toDate().getTime() : null
}

/** A business account that is suspended, banned, inactive or deleted. */
export function isBusinessUnavailable(business: Record<string, unknown> | undefined, user: Record<string, unknown> | undefined): boolean {
  if (!business) return true
  const bad = (v: unknown) => v === 'suspended' || v === 'banned' || v === 'inactive' || v === 'deleted' || v === 'disabled'
  return bad(business.status) || bad(user?.status) || business.suspended === true || business.disabled === true || !!business.deletedAt
}

/**
 * The offer as the public may see it, or null when it must not be listed. A multi-value Raayonit offer keeps only the values
 * still in stock, and its classic price fields follow the first remaining one.
 */
export function publicOfferData(data: Record<string, unknown>, ctx: AvailabilityContext): Record<string, unknown> | null {
  const now = ctx.now ?? Date.now()
  if (data.published === false) return null
  const expiry = toMillis(data.expiryDate)
  if (!isOfferActive({ totalQuantity: typeof data.totalQuantity === 'number' ? data.totalQuantity : null, claimedCount: Number(data.claimedCount) || 0, expiryDate: expiry === null ? null : new Date(expiry) }) || (expiry !== null && expiry < now)) return null
  if (data.fulfillmentType === 'direct_merchant' || (data.fulfillmentType === undefined && typeof data.businessId === 'string' && data.businessId)) {
    if (ctx.activeBusinesses && !(typeof data.businessId === 'string' && ctx.activeBusinesses.has(data.businessId))) return null
  }
  if (data.fulfillmentType !== 'raayonit_pool') return data
  const stocked = (poolId: unknown) => typeof poolId === 'string' && (ctx.poolRemaining.get(poolId) ?? 0) > 0
  const variants = parseVariants(data.variants)
  if (variants.length === 0) return stocked(data.poolId) ? data : null
  const inStock: OfferVariant[] = variants.filter((v) => stocked(v.poolId))
  const first = inStock[0]
  if (!first) return null
  return { ...data, variants: inStock, poolId: first.poolId, originalPrice: first.faceValueAgorot / 100, offerPrice: first.priceAgorot / 100 }
}

/** The multi-chain card lists only the brands that are themselves on sale right now, each linking to its own offer. */
export function withLiveBrandIndex(entries: { id: string; data: Record<string, unknown> }[]): { id: string; data: Record<string, unknown> }[] {
  const brands: BrandIndexEntry[] = entries
    .filter((e) => e.data.fulfillmentType === 'raayonit_pool' && e.data.perkScope !== 'multi_chain')
    .map((e) => ({ offerId: e.id, name: String(e.data.brandName ?? e.data.businessName ?? ''), nameTranslations: e.data.businessTranslations, logoUrl: relocateBundledImage(String(e.data.businessLogoUrl || e.data.imageUrl || '').trim()), branchCount: Number(e.data.chainsCount) || 0, ...(e.data.logoKind === 'photo' ? { photo: true } : {}) }))
    .filter((b) => b.name)
    .sort((a, b) => a.name.localeCompare(b.name, 'he'))
  return entries.map((e) => (e.data.fulfillmentType === 'raayonit_pool' && e.data.perkScope === 'multi_chain'
    ? { id: e.id, data: { ...e.data, brandIndex: brands, participatingChains: brands.map((b) => b.name), chainsCount: brands.length } }
    : e))
}

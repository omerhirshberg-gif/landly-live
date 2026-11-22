import type { OfferVariant } from '@/lib/offers/variants'
import { variantDiscountPercent } from '@/lib/offers/variants'

// The flagship "Multi-Chain Super Vouchers" showcase at the top of /categories and the app's Perks tab: one card per
// denomination of the multi-chain Raayonit voucher. Pure, shared by the website and the Expo app.

export interface ShowcaseCard {
  /** The voucher's value in shekels: 100, 150. */
  denomination: number
  pool: string
  /** What the member pays and the voucher's value, whole shekels. */
  price: number
  value: number
  save: number
  discountPercent: number
  /** The top-value card carries the "Best Value" tag and the midnight-navy surface. */
  best: boolean
  /** The offer page, opened with this value picked. */
  href: string
}

/** The offer page link that opens with a value already chosen. */
export const denominationHref = (offerId: string, denomination: number): string => `/offers/${encodeURIComponent(offerId)}?denomination=${denomination}`

/** One card per variant, cheapest value first; with two or more, the highest value is the flagship. */
export function showcaseCards(offer: { id: string; variants?: readonly OfferVariant[] | null }): ShowcaseCard[] {
  const variants = [...(offer.variants ?? [])].sort((a, b) => a.faceValueAgorot - b.faceValueAgorot)
  return variants.map((v, i) => {
    const value = Math.round(v.faceValueAgorot / 100)
    const price = Math.round(v.priceAgorot / 100)
    return {
      denomination: value,
      pool: v.poolId,
      price,
      value,
      save: value - price,
      discountPercent: variantDiscountPercent(v),
      best: variants.length > 1 && i === variants.length - 1,
      href: denominationHref(offer.id, value),
    }
  })
}

/** The variant a `?denomination=150` link asks for (value in shekels), or null when it matches none. */
export function variantForDenomination(variants: readonly OfferVariant[], raw: unknown): OfferVariant | null {
  const n = typeof raw === 'string' || typeof raw === 'number' ? Number(raw) : NaN
  if (!Number.isFinite(n) || n <= 0) return null
  return variants.find((v) => v.faceValueAgorot === Math.round(n * 100)) ?? null
}

/** Wraps a value (a price, a percentage) so a right-to-left sentence keeps it in reading order (LRI ... PDI). */
export const isolateLtr = (text: string): string => `⁦${text}⁩`

export const BANNER_FALLBACK_PERCENT = 13
export const BANNER_FALLBACK_COUNT = 230

/**
 * The figures on Home's Raayonit entry banner, from live data: the best discount among the flagship's values and the
 * number of participating chains (rounded down to a whole ten). Each falls back to its usual value while data is missing.
 */
export function bannerFigures(offer: { id: string; variants?: readonly OfferVariant[] | null } | null, chainCount: number): { percent: number; count: number } {
  const percent = Math.max(0, ...(offer ? showcaseCards(offer).map((c) => c.discountPercent) : []))
  return {
    percent: percent > 0 ? percent : BANNER_FALLBACK_PERCENT,
    count: chainCount >= 10 ? Math.floor(chainCount / 10) * 10 : chainCount > 0 ? chainCount : BANNER_FALLBACK_COUNT,
  }
}

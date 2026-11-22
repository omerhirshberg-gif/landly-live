// The Raayonit Card's 1-click purchase: which voucher value is selected, and whether it can be bought at all. Pure, shared by the
// website and the Expo app. These are the same guards the offer page applied (a value the member already owns, past expiry), plus sold out.
import type { OfferVariant } from './variants'

export type PurchaseBlock = 'expired' | 'soldOut' | 'owned' | null

export interface FlagshipPurchaseInput {
  variants: readonly OfferVariant[]
  /** The pool the member tapped (or opened with ?denomination=); '' for none. */
  picked: string
  /** Pools the member already owns a voucher from. */
  claimedPools: readonly string[]
  expiryDate?: Date | null
  totalQuantity?: number | null
  claimedCount?: number
  now: number
}

export interface FlagshipPurchase {
  /** The value to buy: the picked one if it is free, else the highest free one (the ladder's "Best value"), else the highest. Undefined with no variants. */
  selected: OfferVariant | undefined
  everyValueOwned: boolean
  block: PurchaseBlock
}

export function flagshipPurchase(input: FlagshipPurchaseInput): FlagshipPurchase {
  const { variants, picked, claimedPools, expiryDate, totalQuantity, claimedCount = 0, now } = input
  const free = variants.filter((v) => !claimedPools.includes(v.poolId))
  const byValue = [...variants].sort((a, b) => b.faceValueAgorot - a.faceValueAgorot)
  const selected = variants.length > 0 ? free.find((v) => v.poolId === picked) ?? byValue.find((v) => free.includes(v)) ?? byValue[0] : undefined
  const everyValueOwned = variants.length > 0 && free.length === 0
  const block: PurchaseBlock = everyValueOwned
    ? 'owned'
    : expiryDate && expiryDate.getTime() < now
      ? 'expired'
      : typeof totalQuantity === 'number' && totalQuantity - claimedCount <= 0
        ? 'soldOut'
        : null
  return { selected, everyValueOwned, block }
}

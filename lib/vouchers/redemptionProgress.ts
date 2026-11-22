import { resolveVoucherValue, shekels, type VoucherValueInput } from './voucherValue'

// What is left on a voucher, read from the voucher's own state: nothing for a redeemed one, otherwise its worth less what is
// recorded as used (`redeemedAgorot`, absent on every voucher issued so far = 0), never below zero. Pure, like voucherValue.ts,
// so web and Expo read one rule; there is no manual entry, the backend's redemption state is the only source.
export interface RedemptionProgressInput extends VoucherValueInput {
  status?: string
  redeemedAgorot?: number | null
}

export interface RedemptionProgress {
  redeemedAgorot: number
  faceValueAgorot: number
  remainingAgorot: number
}

/** Null for a free or non-monetary perk: no balance to show. */
export function resolveVoucherRedemptionProgress(v: RedemptionProgressInput): RedemptionProgress | null {
  const value = resolveVoucherValue(v)
  if (!value || value.faceValueAgorot <= 0) return null
  const faceValueAgorot = value.faceValueAgorot
  const recorded = typeof v.redeemedAgorot === 'number' && Number.isFinite(v.redeemedAgorot) && v.redeemedAgorot > 0 ? Math.round(v.redeemedAgorot) : 0
  const remainingAgorot = v.status === 'redeemed' ? 0 : Math.max(0, faceValueAgorot - recorded)
  return { redeemedAgorot: faceValueAgorot - remainingAgorot, faceValueAgorot, remainingAgorot }
}

/** "₪70", as a left-to-right run to drop into a sentence of either direction. */
export function balanceAmount(p: RedemptionProgress): string {
  return `⁦${shekels(p.remainingAgorot)}⁩`
}

/** A voucher's face value ("₪100"), or null for a free perk: what the gift card's cover shows. */
export function voucherFaceValueText(v: VoucherValueInput): string | null {
  const value = resolveVoucherValue(v)
  return value && value.faceValueAgorot > 0 ? shekels(value.faceValueAgorot) : null
}

// What a member paid for a voucher against what it is worth ("₪79 / ₪100"). Pure, so web, native, the
// order email and the Wallet pass read one rule. Nothing is stored: old vouchers resolve through the fallbacks.

export interface VoucherValueInput {
  /** What was paid, in agorot (set by the payment webhook on the voucher and the order). */
  amountAgorot?: number | null
  /** The voucher's full worth; written for Raayonit pools. */
  faceValueAgorot?: number | null
  /** What the member saved (vouchers since savings tracking). */
  savingsAgorot?: number | null
  /** The order's pre-discount price in shekels (legacy). */
  originalPrice?: number | null
}

export interface VoucherValue {
  paidAgorot: number
  faceValueAgorot: number
  discounted: boolean
}

const positive = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n) && n > 0

/** Paid and full value, or null for a free perk (nothing monetary to compare). Face value is never below what was paid. */
export function resolveVoucherValue(v: VoucherValueInput): VoucherValue | null {
  if (!positive(v.amountAgorot)) return null
  const paid = Math.round(v.amountAgorot)
  const face = positive(v.faceValueAgorot)
    ? v.faceValueAgorot
    : positive(v.savingsAgorot)
      ? paid + v.savingsAgorot
      : positive(v.originalPrice)
        ? Math.round(v.originalPrice * 100)
        : paid
  const faceValueAgorot = Math.max(Math.round(face), paid)
  return { paidAgorot: paid, faceValueAgorot, discounted: faceValueAgorot > paid }
}

/** "₪79" or "₪79.90": whole shekels without decimals. */
export function shekels(agorot: number): string {
  const whole = agorot % 100 === 0
  return `₪${whole ? String(agorot / 100) : (agorot / 100).toFixed(2)}`
}

/** "₪79 / ₪100", always to be rendered left to right (bdi dir="ltr" / ltr text). */
export function formatValueRatio(value: VoucherValue): string {
  return `${shekels(value.paidAgorot)} / ${shekels(value.faceValueAgorot)}`
}

// The purchase terms a voucher carries, shared by the admin offer routes,
// order initiation, the payment webhook and every screen that shows them
// (web checkout and wallet, the mobile wallet). Pure, so it runs anywhere.

/** How long a voucher stays valid after purchase when its offer doesn't say. */
export const DEFAULT_VOUCHER_VALIDITY_DAYS = 180
/** Ten years: anything longer is a typo, not a policy. */
export const MAX_VOUCHER_VALIDITY_DAYS = 3650
export const MAX_REDEMPTION_TERMS_LENGTH = 2000

/** Statutory cancellation window, counted from the purchase date. */
export const CANCELLATION_WINDOW_DAYS = 14
const CANCELLATION_FEE_RATE = 0.05
const CANCELLATION_FEE_CAP_AGOROT = 100_00

const DAY_MS = 24 * 60 * 60 * 1000

export function isValidValidityDays(value: unknown): value is number {
  return Number.isInteger(value) && (value as number) >= 1 && (value as number) <= MAX_VOUCHER_VALIDITY_DAYS
}

/** A stored or submitted validityDays, or the default when it's missing or invalid. */
export function normalizeValidityDays(value: unknown): number {
  return isValidValidityDays(value) ? value : DEFAULT_VOUCHER_VALIDITY_DAYS
}

/** Stored redemption terms as display text: trimmed, '' when missing. */
export function normalizeRedemptionTerms(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

/** When a voucher bought at `purchasedAtMs` stops being valid. */
export function voucherExpiresAtMs(purchasedAtMs: number, validityDays: number): number {
  return purchasedAtMs + normalizeValidityDays(validityDays) * DAY_MS
}

/**
 * The most a cancellation can cost: 5% of the price or ₪100, whichever is
 * lower. Rounded down to the agora, so the fee never exceeds either cap.
 */
export function cancellationFeeAgorot(amountAgorot: number): number {
  if (!Number.isSafeInteger(amountAgorot) || amountAgorot <= 0) return 0
  return Math.min(Math.floor(amountAgorot * CANCELLATION_FEE_RATE), CANCELLATION_FEE_CAP_AGOROT)
}

/**
 * Validates the voucher-terms fields of an admin offer write. Missing fields
 * fall back to the defaults (older admin clients don't send them).
 */
export function parseOfferVoucherTerms(input: { validityDays?: unknown; redemptionTerms?: unknown }):
  | { ok: true; validityDays: number; redemptionTerms: string }
  | { ok: false; error: string } {
  const validityDays = input.validityDays ?? DEFAULT_VOUCHER_VALIDITY_DAYS
  if (!isValidValidityDays(validityDays)) {
    return { ok: false, error: `offer.validityDays must be a whole number of days from 1 to ${MAX_VOUCHER_VALIDITY_DAYS}.` }
  }
  if (input.redemptionTerms !== undefined && input.redemptionTerms !== null && typeof input.redemptionTerms !== 'string') {
    return { ok: false, error: 'offer.redemptionTerms must be text.' }
  }
  const redemptionTerms = normalizeRedemptionTerms(input.redemptionTerms)
  if (redemptionTerms.length > MAX_REDEMPTION_TERMS_LENGTH) {
    return { ok: false, error: `offer.redemptionTerms must be at most ${MAX_REDEMPTION_TERMS_LENGTH} characters.` }
  }
  return { ok: true, validityDays, redemptionTerms }
}

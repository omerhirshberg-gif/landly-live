// The savings arithmetic of lib/member/savingsMath.ts, for the backfill (a script
// can't import that TypeScript). tests/unit/voucherSavingsBackfill.test.ts keeps
// the two identical.

/** What a purchase saved, in agorot: the original price minus what was paid; 0 with no original price or on a price rise. */
export function savingsAgorotOf(originalPrice, paidAgorot) {
  if (typeof originalPrice !== 'number' || !Number.isFinite(originalPrice) || originalPrice <= 0) return 0
  return Math.max(0, Math.round(originalPrice * 100) - paidAgorot)
}

/** The savings to store on a voucher from its order: 0 unless the order is paid (as lib/member/savings.ts counts it). */
export function savingsFromOrder(order) {
  if (!order || order.status !== 'paid' || typeof order.amount !== 'number') return 0
  return savingsAgorotOf(order.originalPrice, Math.round(order.amount * 100))
}

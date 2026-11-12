// Pure savings arithmetic, shared by the payment webhook (server) and the
// wallet (client). In agorot, so ₪0.1 + ₪0.2 never comes out as 0.30000000000000004.

/** What a purchase saved: the original price minus what was paid; 0 with no original price or on a price rise. */
export function savingsAgorotOf(originalPrice: unknown, paidAgorot: number): number {
  if (typeof originalPrice !== 'number' || !Number.isFinite(originalPrice) || originalPrice <= 0) return 0
  return Math.max(0, Math.round(originalPrice * 100) - paidAgorot)
}

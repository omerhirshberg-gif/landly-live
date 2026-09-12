export function isOfferActive(o: { totalQuantity: number | null; claimedCount: number; expiryDate: Date | null }): boolean {
  const notSoldOut = o.totalQuantity === null || o.claimedCount < o.totalQuantity
  const notExpired = o.expiryDate === null || o.expiryDate.getTime() >= Date.now()
  return notSoldOut && notExpired
}

export type OfferStatus = 'active' | 'soldOut' | 'expired'

// Same inputs as isOfferActive, but distinguishes *why* an offer isn't active
// (business dashboard shows this instead of a plain active/inactive flag).
// Expired takes priority when both apply -- an offer that sold out and then
// also passed its expiry date is more accurately "expired".
export function getOfferStatus(o: { totalQuantity: number | null; claimedCount: number; expiryDate: Date | null }): OfferStatus {
  if (o.expiryDate !== null && o.expiryDate.getTime() < Date.now()) return 'expired'
  if (o.totalQuantity !== null && o.claimedCount >= o.totalQuantity) return 'soldOut'
  return 'active'
}

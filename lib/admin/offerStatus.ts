export function isOfferActive(o: { totalQuantity: number | null; claimedCount: number; expiryDate: Date | null }): boolean {
  const notSoldOut = o.totalQuantity === null || o.claimedCount < o.totalQuantity
  const notExpired = o.expiryDate === null || o.expiryDate.getTime() >= Date.now()
  return notSoldOut && notExpired
}

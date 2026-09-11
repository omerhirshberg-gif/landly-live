// Shared by every offer write path (create, business+offer create, edit) so
// the "offerPrice < originalPrice" rule can't drift between them.
export function validateOfferPrices(originalPrice: number, offerPrice: number): string | null {
  if (!Number.isFinite(originalPrice) || originalPrice <= 0) return 'originalPrice must be a positive number.'
  if (!Number.isFinite(offerPrice) || offerPrice <= 0) return 'offerPrice must be a positive number.'
  if (offerPrice >= originalPrice) return 'offerPrice must be less than originalPrice.'
  return null
}

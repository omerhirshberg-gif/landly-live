import { getOffersByIds } from '@/lib/firebase/offers'

// "Total Saved" on the member dashboards (web /member, the app's My Pass):
// for each redeemed voucher, its offer's original price minus what was paid.
// An offer deleted since counts 0, and a price rise never counts negative.
export function sumSavings(
  vouchers: readonly { offerId: string }[],
  offers: readonly { id: string; originalPrice: number; offerPrice: number }[]
): number {
  const savedPerOffer = new Map(offers.map((o) => [o.id, Math.max(0, o.originalPrice - o.offerPrice)]))
  return vouchers.reduce((sum, v) => sum + (savedPerOffer.get(v.offerId) ?? 0), 0)
}

export async function totalSaved(redeemed: readonly { offerId: string }[]): Promise<number> {
  if (redeemed.length === 0) return 0
  const offers = await getOffersByIds([...new Set(redeemed.map((v) => v.offerId))])
  return sumSavings(redeemed, offers)
}

import { getOrdersByIds, type OrderDocument } from '@/lib/firebase/orders'

// "Total Saved" on the member dashboards (web /member, the app's My Pass):
// counted from the moment of purchase, so every active and redeemed voucher
// adds its order's original price minus what was paid. Both prices are the
// ones frozen on the order at checkout, so a merchant editing the offer later
// never changes a member's savings. An order that isn't paid, has no original
// price, or can't be read counts 0, and so does a price rise.
export function sumSavings(orders: readonly (Pick<OrderDocument, 'status' | 'originalPrice' | 'amount'> | null)[]): number {
  // In agorot, so ₪0.1 + ₪0.2 never comes out as 0.30000000000000004.
  const agorot = orders.reduce((sum, order) => {
    if (!order || order.status !== 'paid' || order.originalPrice === null) return sum
    return sum + Math.max(0, Math.round(order.originalPrice * 100) - Math.round(order.amount * 100))
  }, 0)
  return agorot / 100
}

/** A voucher's id is its order's id (`${uid}_${offerId}`), so each voucher's order is one read. */
export async function totalSaved(vouchers: readonly { id: string }[]): Promise<number> {
  if (vouchers.length === 0) return 0
  return sumSavings(await getOrdersByIds([...new Set(vouchers.map((v) => v.id))]))
}

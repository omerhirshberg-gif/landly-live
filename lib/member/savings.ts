import { getOrdersByIds, type OrderDocument } from '@/lib/firebase/orders'
import { savingsAgorotOf } from './savingsMath'

export { savingsAgorotOf } from './savingsMath'

// "Total Saved" on the member dashboards (web /member, the app's My Pass):
// counted from the moment of purchase, so every active and redeemed voucher
// adds its order's original price minus what was paid. Both prices are the
// ones frozen on the order at checkout, so a merchant editing the offer later
// never changes a member's savings. An order that isn't paid, has no original
// price, or can't be read counts 0, and so does a price rise.
export function sumSavings(orders: readonly (Pick<OrderDocument, 'status' | 'originalPrice' | 'amount'> | null)[]): number {
  const agorot = orders.reduce((sum, order) => {
    if (!order || order.status !== 'paid' || order.originalPrice === null) return sum
    return sum + savingsAgorotOf(order.originalPrice, Math.round(order.amount * 100))
  }, 0)
  return agorot / 100
}

// Vouchers issued since savings were stored on them carry `savingsAgorot` and
// need no read at all. Older ones fall back to their order (a voucher's id is
// its order's id), read in batches and remembered: an order's frozen prices
// never change, so a voucher snapshot refiring never re-reads it.
const legacySavings = new Map<string, number>()

export interface SavingsVoucher {
  id: string
  savingsAgorot?: number | null
}

export async function totalSaved(uid: string, vouchers: readonly SavingsVoucher[]): Promise<number> {
  let agorot = 0
  const legacy = new Set<string>()
  for (const voucher of vouchers) {
    if (typeof voucher.savingsAgorot === 'number') agorot += voucher.savingsAgorot
    else if (legacySavings.has(voucher.id)) agorot += legacySavings.get(voucher.id)!
    else legacy.add(voucher.id)
  }
  if (legacy.size > 0) {
    const ids = [...legacy]
    const orders = await getOrdersByIds(uid, ids)
    ids.forEach((id, i) => {
      const order = orders[i]
      const saved = Math.round(sumSavings([order]) * 100)
      // An unreadable order counts 0 now but is retried next time.
      if (order) legacySavings.set(id, saved)
      agorot += saved
    })
  }
  return agorot / 100
}

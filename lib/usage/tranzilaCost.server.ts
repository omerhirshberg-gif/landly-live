import 'server-only'
import { Timestamp, type Firestore } from 'firebase-admin/firestore'
import { DEV_SANDBOX_TERMINAL } from '@/lib/payments/devSandbox'
import type { TranzilaUsage } from './usageReport'

// The month's real card payments, for Tranzila's fee (TRANZILA_FEE in
// lib/usage/pricing.ts): paid orders (status 'paid', paidAt in the UTC month),
// sandbox orders left out. Reads nothing until TRANZILA_TERMINAL is set. Needs
// the composite index orders(status, paidAt) in firebase.indexes.json.

export const tranzilaConfigured = (): boolean => !!process.env.TRANZILA_TERMINAL?.trim()

export async function loadTranzilaUsage(db: Firestore, month: string): Promise<TranzilaUsage> {
  if (!tranzilaConfigured()) return { configured: false, transactions: 0, volumeIls: 0, unavailable: false }
  const start = new Date(`${month}-01T00:00:00Z`)
  const end = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 1))
  try {
    const snap = await db
      .collection('orders')
      .where('status', '==', 'paid')
      .where('paidAt', '>=', Timestamp.fromDate(start))
      .where('paidAt', '<', Timestamp.fromDate(end))
      .select('amount', 'amountAgorot', 'terminal')
      .get()
    let transactions = 0
    let agorot = 0
    for (const doc of snap.docs) {
      const order = doc.data() as { amount?: unknown; amountAgorot?: unknown; terminal?: unknown }
      if (order.terminal === DEV_SANDBOX_TERMINAL) continue
      const value = Number.isInteger(order.amountAgorot) ? (order.amountAgorot as number) : typeof order.amount === 'number' ? Math.round(order.amount * 100) : NaN
      if (!Number.isFinite(value) || value < 0) continue
      transactions += 1
      agorot += value
    }
    return { configured: true, transactions, volumeIls: agorot / 100, unavailable: false }
  } catch (error) {
    console.error('[usage] reading the paid orders failed', error)
    return { configured: true, transactions: 0, volumeIls: 0, unavailable: true }
  }
}

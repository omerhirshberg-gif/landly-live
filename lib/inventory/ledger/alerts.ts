import 'server-only'
import { Timestamp, type Firestore } from 'firebase-admin/firestore'
import { ALERTS_COLLECTION, EVENTS_COLLECTION, PRODUCTS_COLLECTION, SUPPLIERS_COLLECTION, VOUCHERS_COLLECTION, type SupplierId } from './types'
import { countInStock } from './stock'
import { SupplierNotConfiguredError, SupplierUnsupportedError } from '../suppliers/SupplierAdapter'

// Alerts for the admin's Alerts tab (inventoryAlerts/{id}, deterministic ids so a daily run never duplicates) and, for the ones
// that need action, one email (lib/inventory/ledger/alertEmail.ts):
//   expiry_30 / expiry_7   unsold IN_STOCK vouchers that expire within 30 / 7 days
//   low_stock              a product at or under its threshold
//   balance_discrepancy    a balance that its voucherEvents do not explain
//   sync_failures          3 consecutive failures calling a supplier
const DAY_MS = 86_400_000

export type AlertKind = 'expiry_30' | 'expiry_7' | 'low_stock' | 'balance_discrepancy' | 'sync_failures'
export interface InventoryAlert {
  kind: AlertKind
  severity: 'info' | 'warning' | 'critical'
  title: string
  detail: Record<string, unknown>
  day: string
  createdAt: Timestamp
  resolvedAt: Timestamp | null
}

const dayOf = (now: Timestamp) => new Date(now.toMillis() + 2 * 3600_000).toISOString().slice(0, 10)

/** Writes one alert unless today's already exists. Returns true when it is new (so the caller emails once). */
export async function raiseAlert(db: Firestore, id: string, alert: Omit<InventoryAlert, 'createdAt' | 'resolvedAt' | 'day'>, now: Timestamp = Timestamp.now()): Promise<boolean> {
  const ref = db.collection(ALERTS_COLLECTION).doc(`${id}_${dayOf(now)}`)
  try {
    await ref.create({ ...alert, day: dayOf(now), createdAt: now, resolvedAt: null })
    return true
  } catch {
    return false
  }
}

/** The balance the ledger says a voucher should have: face value minus redemptions, plus signed adjustments. Pure. */
export function expectedBalance(faceValueAgorot: number, events: readonly { type: string; amountAgorot: number }[]): number {
  return events.reduce((bal, e) => (e.type === 'REDEMPTION' || e.type === 'REDEEMED' ? bal - e.amountAgorot : e.type === 'ADJUSTMENT' ? bal + e.amountAgorot : bal), faceValueAgorot)
}

export interface AlertRun { raised: AlertKind[]; counts: Record<AlertKind, number> }

/** The daily inventory check. Safe to run repeatedly. */
export async function runInventoryAlerts(db: Firestore, now: Timestamp = Timestamp.now()): Promise<AlertRun> {
  const counts: Record<AlertKind, number> = { expiry_30: 0, expiry_7: 0, low_stock: 0, balance_discrepancy: 0, sync_failures: 0 }
  const raised: AlertKind[] = []
  const bump = (k: AlertKind, isNew: boolean, n = 1) => { if (isNew) { counts[k] += n; if (!raised.includes(k)) raised.push(k) } }

  // Unsold stock nearing its expiry, per product, at 30 and 7 days.
  for (const [kind, days] of [['expiry_30', 30], ['expiry_7', 7]] as const) {
    const soon = await db.collection(VOUCHERS_COLLECTION).where('status', '==', 'IN_STOCK').where('expiresAt', '<=', Timestamp.fromMillis(now.toMillis() + days * DAY_MS)).limit(1000).get()
    const byProduct = new Map<string, number>()
    for (const d of soon.docs) byProduct.set(d.data().productId, (byProduct.get(d.data().productId) ?? 0) + 1)
    for (const [productId, n] of byProduct) bump(kind, await raiseAlert(db, `${kind}_${productId}`, { kind, severity: days === 7 ? 'critical' : 'warning', title: `${n} unsold code(s) expire within ${days} days`, detail: { productId, count: n, days } }, now), n)
  }

  // Low stock per face-value product.
  const products = await db.collection(PRODUCTS_COLLECTION).where('active', '==', true).get()
  for (const p of products.docs) {
    const data = p.data()
    if (data.issueMode === 'dynamic') continue
    const threshold = Number.isInteger(data.lowStockThreshold) ? data.lowStockThreshold : 10
    const left = await countInStock(db, p.id)
    if (left <= threshold) bump('low_stock', await raiseAlert(db, `low_stock_${p.id}`, { kind: 'low_stock', severity: left === 0 ? 'critical' : 'warning', title: `Low stock: ${left} left`, detail: { productId: p.id, left, threshold, faceValueAgorot: data.faceValueAgorot } }, now))
  }

  // Balance changes that no event explains: sold codes whose balance differs from face value minus their events.
  const live = await db.collection(VOUCHERS_COLLECTION).where('status', 'in', ['DELIVERED', 'PARTIALLY_REDEEMED']).limit(500).get()
  for (const v of live.docs) {
    const data = v.data()
    const events = await db.collection(EVENTS_COLLECTION).where('voucherId', '==', v.id).get()
    const expected = expectedBalance(data.faceValueAgorot, events.docs.map((e) => e.data() as { type: string; amountAgorot: number }))
    if (expected !== data.balanceAgorot) bump('balance_discrepancy', await raiseAlert(db, `balance_${v.id}`, { kind: 'balance_discrepancy', severity: 'critical', title: 'Balance does not match the ledger', detail: { voucherId: v.id, expected, actual: data.balanceAgorot } }, now))
  }
  return { raised, counts }
}

/**
 * Runs one supplier call, tracking consecutive failures on suppliers/{id}. The third failure in a row raises a critical alert;
 * a success resets the count. The error is rethrown (message only: never the request or a code).
 */
export async function trackSupplierCall<T>(db: Firestore, supplierId: SupplierId, call: () => Promise<T>, now: () => Timestamp = Timestamp.now): Promise<T> {
  const ref = db.collection(SUPPLIERS_COLLECTION).doc(supplierId)
  try {
    const out = await call()
    await ref.set({ consecutiveFailures: 0, lastSuccessAt: now() }, { merge: true })
    return out
  } catch (error) {
    // A supplier that is simply not switched on is not a failure to alert about.
    if (error instanceof SupplierNotConfiguredError || error instanceof SupplierUnsupportedError) throw error
    const failures = await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref)
      const next = (Number(snap.data()?.consecutiveFailures) || 0) + 1
      tx.set(ref, { consecutiveFailures: next, lastFailureAt: now() }, { merge: true })
      return next
    })
    if (failures >= 3) await raiseAlert(db, `sync_failures_${supplierId}`, { kind: 'sync_failures', severity: 'critical', title: `${supplierId}: ${failures} consecutive failures`, detail: { supplierId, failures } }, now())
    throw error
  }
}

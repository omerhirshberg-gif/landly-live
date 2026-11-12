// Member-facing order numbers: #1001, #1002, ... roughly in settlement order.
//
// One global counter doc would cap checkout at about one settlement a second
// (Firestore's sustained write rate for a single document), so the sequence is
// sharded: ORDER_COUNTER_SHARDS counter docs at orderCounter/{0..9}, each
// holding `count`, how many numbers that shard has issued. A shard issues
//   legacyLast + count * ORDER_COUNTER_SHARDS + shard + 1
// so shards never collide, every number is above the legacy counter, and
// numbers still climb together (shards drift apart only by chance).
//
// The legacy counter, metadata/counters (orderSequence, the last number issued
// before sharding), is now read-only: it is the base the shards continue from.
// A read of an unchanged doc causes no write contention. A shard is picked from
// the order id, so a retry of the same order always lands on the same shard.
// Shared by the server, the web app, the Expo app (@shared/payments/orderNumber)
// and the confirmation email.
export const ORDER_COUNTER_PATH = { collection: 'metadata', doc: 'counters' } as const
export const ORDER_SHARD_COLLECTION = 'orderCounter'
export const ORDER_COUNTER_SHARDS = 10
/** The counter's value before the first order: the first one settled is #1001. */
export const ORDER_SEQUENCE_START = 1000

/** The shard (0..9) that numbers this order; stable for an order id. */
export function orderShardFor(orderId: string): number {
  let hash = 2166136261
  for (let i = 0; i < orderId.length; i++) hash = Math.imul(hash ^ orderId.charCodeAt(i), 16777619)
  return (hash >>> 0) % ORDER_COUNTER_SHARDS
}

/** The number a shard issues next, given the legacy counter and how many that shard has issued. */
export function shardedOrderNumber(legacyLast: number, issued: number, shard: number): number {
  return legacyLast + issued * ORDER_COUNTER_SHARDS + shard + 1
}

export function isOrderNumber(value: unknown): value is number {
  return Number.isSafeInteger(value) && (value as number) > ORDER_SEQUENCE_START
}

export function formatOrderNumber(orderNumber: number): string {
  return `#${orderNumber}`
}

/** The stored display form, if it's a well-formed one ("#1001"); null otherwise. */
export function normalizeDisplayOrderNumber(value: unknown): string | null {
  return typeof value === 'string' && /^#\d+$/.test(value) ? value : null
}

/**
 * What the member sees and copies: the sequential number, or -- for orders
 * settled before numbering existed -- the document id, prefixed the same way.
 */
export function orderReference(displayOrderNumber: string | null, orderId: string): string {
  return displayOrderNumber ?? `#${orderId}`
}

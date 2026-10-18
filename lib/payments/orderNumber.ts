// Member-facing order numbers: #1001, #1002, ... in settlement order. The
// counter lives at metadata/counters (orderSequence, the last number issued)
// and is advanced only inside claimOfferForOrder's transaction, which stamps
// the number on both the order and its voucher. Shared by the server, the web
// app, the Expo app (@shared/payments/orderNumber) and the confirmation email.
export const ORDER_COUNTER_PATH = { collection: 'metadata', doc: 'counters' } as const
/** The counter's value before the first order: the first one settled is #1001. */
export const ORDER_SEQUENCE_START = 1000

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

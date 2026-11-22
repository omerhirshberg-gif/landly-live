import type { SupplierId } from '../ledger/types'

// One interface for every supplier. Raayonit sells pre-bought stock (a two-column sheet, no API); Multipass issues codes at the
// sale and reports redemptions. A method a supplier cannot do throws SupplierUnsupportedError, never a silent success.

export class SupplierNotConfiguredError extends Error {
  constructor(supplier: string, what: string) { super(`${supplier}: ${what} is not configured.`) }
}
export class SupplierUnsupportedError extends Error {
  constructor(supplier: string, operation: string) { super(`${supplier} does not support ${operation}.`) }
}
export class SupplierRequestError extends Error {
  constructor(supplier: string, readonly status: number) { super(`${supplier} request failed with HTTP ${status}.`) }
}

export interface OrderItem {
  orderId: string
  productId: string
  faceValueAgorot: number
  businessId?: string | null
  /** Idempotency key for the supplier: the same order always asks for the same code. */
  externalEventId: string
}

export interface IssuedCode {
  code: string
  /** The supplier's own reference for the code. */
  supplierRef: string
  expiresAt?: Date | null
}

export interface BalanceResult {
  /** null when the supplier cannot say. */
  balanceAgorot: number | null
  /** 'supplier': asked the supplier's API. 'ledger': the supplier has no API, this is our own record. */
  source: 'supplier' | 'ledger'
}

export interface SupplierRedemption {
  externalEventId: string
  supplierRef: string
  amountAgorot: number
  businessId: string | null
  occurredAt: Date
}

export interface SupplierBusiness {
  externalId: string
  name: string
  redemptionMethod?: string | null
  active: boolean
}

export interface SupplierAdapter {
  readonly id: SupplierId
  /** Stock suppliers: bring codes in (the batch importer). */
  importStock(...args: unknown[]): Promise<unknown>
  /** Issue-at-sale suppliers: a code for one order item. Idempotent by `item.externalEventId`. */
  issue(item: OrderItem): Promise<IssuedCode>
  checkBalance(ref: { code?: string; supplierRef?: string; ledgerBalanceAgorot?: number }): Promise<BalanceResult>
  getRedemptions(since: Date): Promise<SupplierRedemption[]>
  voidCode(ref: { code?: string; supplierRef?: string }, reason: string): Promise<{ confirmed: boolean }>
  syncBusinesses(): Promise<SupplierBusiness[]>
}

export interface RetryOptions { attempts?: number; baseMs?: number; sleep?: (ms: number) => Promise<void> }

/** Exponential backoff with jitter: baseMs, 2x, 4x... Retries only transient failures (network, 5xx, 429). */
export async function withRetry<T>(fn: () => Promise<T>, { attempts = 3, baseMs = 400, sleep = (ms) => new Promise((r) => setTimeout(r, ms)) }: RetryOptions = {}): Promise<T> {
  let last: unknown
  for (let i = 0; i < attempts; i++) {
    try { return await fn() } catch (error) {
      last = error
      const transient = !(error instanceof SupplierRequestError) || error.status >= 500 || error.status === 429
      if (!transient || error instanceof SupplierNotConfiguredError || error instanceof SupplierUnsupportedError || i === attempts - 1) break
      await sleep(baseMs * 2 ** i + Math.floor(Math.random() * baseMs))
    }
  }
  throw last
}

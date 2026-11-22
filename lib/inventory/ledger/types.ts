import type { Timestamp } from 'firebase-admin/firestore'

// The voucher inventory ledger (Raayonit pre-bought stock and Multipass direct issuance).
// Money is in agorot. Every collection here is Admin-SDK only (firestore.rules denies clients).
//
// Names are prefixed so they never collide with `vouchers/{orderId}`, the member's wallet document.
//   suppliers/{raayonit|multipass}      who we buy from
//   inventoryProducts/{id}              what we sell; for Raayonit the id IS the legacy couponPools id,
//                                       so offer variants and orders keep pointing at the same string
//   inventoryVouchers/{codeHash}        one code; the doc id is its hash, so a code exists once
//   importBatches/{id}                  one supplier file
//   voucherEvents/{id}                  strictly append-only ledger
//   reconciliationRuns/{id}, businessChanges/{id}, inventoryAlerts/{id}

export const SUPPLIERS_COLLECTION = 'suppliers'
export const PRODUCTS_COLLECTION = 'inventoryProducts'
export const VOUCHERS_COLLECTION = 'inventoryVouchers'
export const BATCHES_COLLECTION = 'importBatches'
export const EVENTS_COLLECTION = 'voucherEvents'
export const RECONCILIATION_COLLECTION = 'reconciliationRuns'
export const BUSINESS_CHANGES_COLLECTION = 'businessChanges'
export const ALERTS_COLLECTION = 'inventoryAlerts'

export const SUPPLIER_IDS = ['raayonit', 'multipass'] as const
export type SupplierId = (typeof SUPPLIER_IDS)[number]
export const isSupplierId = (v: unknown): v is SupplierId => SUPPLIER_IDS.includes(v as SupplierId)

export const VOUCHER_STATUSES = [
  'STAGED', 'IN_STOCK', 'RESERVED', 'SOLD', 'DELIVERED', 'PARTIALLY_REDEEMED', 'REDEEMED', 'CANCELLED', 'EXPIRED', 'VOID',
] as const
export type InventoryStatus = (typeof VOUCHER_STATUSES)[number]

/** No further state can follow these (VOID is manual; REDEEMED and EXPIRED are final). */
export const TERMINAL_STATUSES: readonly InventoryStatus[] = ['REDEEMED', 'EXPIRED', 'VOID']

export const EVENT_TYPES = [
  'IMPORTED', 'ISSUED', 'RESERVED', 'RELEASED', 'SOLD', 'DELIVERED', 'REDEMPTION', 'REDEEMED', 'CANCELLED', 'RESTOCKED', 'EXPIRED', 'VOID', 'ADJUSTMENT',
] as const
export type VoucherEventType = (typeof EVENT_TYPES)[number]
export type EventSource = 'system' | 'multipass' | 'manual'

/** How long a checkout holds a code. */
export const RESERVATION_MINUTES = 15
export const RESERVATION_MS = RESERVATION_MINUTES * 60 * 1000
/** Admin cancellation window, counted from the purchase. */
export const CANCELLATION_WINDOW_DAYS = 14
/** A Raayonit voucher lasts 5 calendar years from the purchase unless its batch names an earlier date. */
export const VOUCHER_VALIDITY_YEARS = 5

export interface InventoryProduct {
  supplierId: SupplierId
  title: string
  /** Only a direct Multipass product names its merchant; a Raayonit voucher is multi-chain. */
  businessId?: string | null
  faceValueAgorot: number
  salePriceAgorot: number
  costPriceAgorot: number
  validityDays: number | null
  /** 'stock': pre-bought codes; 'dynamic': issued by the supplier at the sale (Multipass). */
  issueMode: 'stock' | 'dynamic'
  lowStockThreshold: number
  active: boolean
  createdAt: Timestamp
  updatedAt: Timestamp
}

export interface InventoryVoucher {
  productId: string
  supplierId: SupplierId
  codeEncrypted: string
  codeHash: string
  status: InventoryStatus
  faceValueAgorot: number
  balanceAgorot: number
  expiresAt: Timestamp | null
  importBatchId: string | null
  orderItemId: string | null
  supplierRef: string | null
  reservedUntil: Timestamp | null
  reservedForOrderId: string | null
  soldAt: Timestamp | null
  createdAt: Timestamp
  updatedAt: Timestamp
}

export interface VoucherEvent {
  voucherId: string
  type: VoucherEventType
  fromStatus: InventoryStatus | null
  toStatus: InventoryStatus | null
  amountAgorot: number
  businessId: string | null
  source: EventSource
  externalEventId: string | null
  occurredAt: Timestamp
  meta: { reason?: string; actor?: string; [key: string]: unknown }
}

export interface RejectedRow {
  /** 1-based row number in the supplier's file. */
  row: number
  reason: 'empty' | 'duplicate_in_file' | 'duplicate_in_stock' | 'too_long' | 'bad_amount' | 'wrong_amount' | 'no_product'
  /** The code is NEVER stored here, only its last 4 characters for the admin to find the row. */
  codeTail: string
  amountAgorot: number | null
}

export interface ImportBatch {
  supplierId: SupplierId
  fileName: string
  fileHash: string
  rowsTotal: number
  rowsOk: number
  rowsRejected: number
  rejectedRows: RejectedRow[]
  invoiceTotalExpectedAgorot: number
  invoiceTotalActualAgorot: number
  /** Optional: an explicit expiry for every code in the file (the earlier of this and purchase + 5 years applies). */
  expiresAt: Timestamp | null
  status: 'pending_approval' | 'approved' | 'rejected'
  stagingComplete: boolean
  importedAt: Timestamp
  importedBy: string
  approvedAt: Timestamp | null
  approvedBy: string | null
  /** How many staged vouchers are already IN_STOCK (an approval resumes from here after a failure). */
  approvedCount: number
}

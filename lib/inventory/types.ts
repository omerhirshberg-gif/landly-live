import type { Timestamp } from 'firebase-admin/firestore'

// How an offer's vouchers are fulfilled.
//  - direct_merchant: the merchant honours the voucher; GoLandly settles with them
//    (lib/finance/settlement.ts).
//  - multipass_pool: a pre-bought Multipass code is handed out at checkout
//    (lib/inventory/poolAllocation.ts); no merchant payout.
export type FulfillmentType = 'direct_merchant' | 'multipass_pool'

export function parseFulfillmentType(value: unknown): FulfillmentType {
  return value === 'multipass_pool' ? 'multipass_pool' : 'direct_merchant'
}

export type PoolStatus = 'active' | 'depleted' | 'archived'
export type PoolItemStatus = 'available' | 'reserved' | 'allocated' | 'expired'

// couponPools/{poolId}: Admin SDK only (firestore.rules denies clients).
// Money is in agorot. Items are numbered 1..lastSeq and handed out in order
// from nextSeq, so allocation needs no query inside the checkout transaction.
export interface MultipassPool {
  offerId: string
  provider: 'multipass'
  totalPurchased: number // codes uploaded so far (= lastSeq)
  allocatedCount: number
  remainingCount: number // uploaded, not allocated, not expired
  warningThreshold: number
  lowStock: boolean
  unitCost: number
  retailPrice: number
  status: PoolStatus
  nextSeq: number
  lastSeq: number
  createdAt: Timestamp
  updatedAt: Timestamp
}

// couponPools/{poolId}/items/{seq, zero-padded}
export interface PoolItem {
  seq: number
  codeCipher: string
  /** A supplier serial or PIN, encrypted the same way; absent for plain codes. */
  pinCipher?: string
  codeHash: string // SHA-256 of the plaintext, so a re-upload skips duplicates
  status: PoolItemStatus
  orderId: string | null
  userId: string | null
  allocatedAt: Timestamp | null
  expiresAt: Timestamp | null
}

export const POOL_COLLECTION = 'couponPools'
export const poolItemId = (seq: number) => String(seq).padStart(8, '0')

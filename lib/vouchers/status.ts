// A voucher's stored status, read the same way everywhere (the member's
// wallet, the Apple Wallet pass route). Pure, so server and client share it.
//
//   active     -- issued, not yet used
//   redeemed   -- used at the merchant; the only status that enters settlement
//   refunded   -- cancelled through support after purchase
//   cancelled  -- cancelled because its owner's account was permanently deleted
//                 (lib/users/deleteUserPermanently.server.ts); never redeemable
//
// A document with no status, or an unknown one, is read as active, so every
// terminal status has to be listed here or it would come back to life.
export const VOUCHER_STATUSES = ['active', 'redeemed', 'refunded', 'cancelled'] as const
export type VoucherStatus = (typeof VOUCHER_STATUSES)[number]

export function parseVoucherStatus(value: unknown): VoucherStatus {
  return value === 'redeemed' || value === 'refunded' || value === 'cancelled' ? value : 'active'
}

/** Whether a voucher in this status can still be redeemed or added to Wallet. */
export const isLiveVoucherStatus = (status: VoucherStatus): boolean => status === 'active'

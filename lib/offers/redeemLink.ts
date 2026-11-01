// What a voucher's QR code encodes -- shared so the web member area, the
// mobile wallet and the Apple Wallet pass show businesses the exact same code.
// The key is the voucher's random redeemToken: its id (`${uid}_${offerId}`) is
// predictable from public offer ids, so it must never be what a scan redeems.
// Only a voucher from before tokens existed (and not yet backfilled) still
// shows its id. Pure: the pass builder uses it on the server.
export function redeemVoucherKey(voucher: { id: string; redeemToken: string | null }): string {
  return voucher.redeemToken ?? voucher.id
}

export function voucherRedeemUrl(redeemKey: string): string {
  return `https://golandly.com/redeem/${redeemKey}`
}

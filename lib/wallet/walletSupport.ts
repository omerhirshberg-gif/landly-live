// What to offer on this device. Pure, so the website and the Expo web build
// share it and it tests without a browser.
//  badge    -- Safari on iPhone, iPad or Mac, and the other iOS browsers (all WebKit)
//  in-app   -- an app's embedded browser on iOS: badge, plus a hint, as many of
//              them swallow the .pkpass download
//  handoff  -- a desktop browser: no badge, a quiet "Add on your iPhone"
//  none     -- Android and anything else: nothing at all
export type WalletSupport = 'badge' | 'in-app' | 'handoff' | 'none'

const IN_APP_BROWSER = /FBAN|FBAV|FB_IAB|Instagram|Line\/|TikTok|musical_ly|BytedanceWebview|Twitter|LinkedInApp|Snapchat|Pinterest/i

export function walletSupport(userAgent: string, maxTouchPoints: number): WalletSupport {
  if (/Android/i.test(userAgent)) return 'none'
  // iPadOS Safari reports itself as a Mac; a touch screen gives it away.
  const ios = /iPhone|iPad|iPod/i.test(userAgent) || (/Macintosh/.test(userAgent) && maxTouchPoints > 1)
  if (ios) return IN_APP_BROWSER.test(userAgent) ? 'in-app' : 'badge'
  if (/Macintosh/.test(userAgent) && /Version\/[\d.]+.*Safari\//.test(userAgent)) return 'badge'
  return /Macintosh|Windows|Linux|CrOS/.test(userAgent) ? 'handoff' : 'none'
}

/** Whether a voucher can go into Wallet at all; the server checks the same (lib/wallet/passVoucher.ts). */
export function canOfferWalletPass(voucher: { status: string; redeemToken: string | null; expiresAt: Date | null }, nowMs: number): boolean {
  return voucher.status === 'active' && !!voucher.redeemToken && (!voucher.expiresAt || voucher.expiresAt.getTime() > nowMs)
}

/** Apple's own badge artwork, as downloaded from developer.apple.com/wallet (see docs/apple-wallet-configuration.md). */
export function walletBadgePath(lang: string): string {
  return `/wallet/add-to-apple-wallet-${lang}.svg`
}

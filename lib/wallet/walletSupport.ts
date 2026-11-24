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

/**
 * Whether a voucher can go into Wallet at all (Apple or Google); the server checks the same (lib/wallet/passVoucher.ts).
 * A code-only voucher (Raayonit) has no redeem token, only its own code, so that counts instead.
 */
export function canOfferWalletPass(
  voucher: { status: string; redeemToken: string | null; expiresAt: Date | null; externalCode?: string | null; redemptionKind?: string | null },
  nowMs: number,
): boolean {
  const hasCode = voucher.redemptionKind === 'code_only' ? !!voucher.externalCode : !!voucher.redeemToken || !!voucher.externalCode
  return voucher.status === 'active' && hasCode && (!voucher.expiresAt || voucher.expiresAt.getTime() > nowMs)
}

/** Apple's own badge artwork, as downloaded from developer.apple.com/wallet (see docs/apple-wallet-configuration.md). */
export function walletBadgePath(lang: string): string {
  return `/wallet/add-to-apple-wallet-${lang}.svg`
}

// Google Wallet (the same save link everywhere: Google's own page or app takes over).
//  badge   -- Android browsers, and desktop browsers (the pass lands in the member's Google account and syncs to their phone)
//  in-app  -- an app's embedded browser on Android: badge, plus a hint to open it in Chrome
//  none    -- iPhone, iPad and any other iOS browser (Apple Wallet only there), and anything unknown
export type GoogleWalletSupport = 'badge' | 'in-app' | 'none'

export function googleWalletSupport(userAgent: string, maxTouchPoints: number): GoogleWalletSupport {
  if (/iPhone|iPad|iPod/i.test(userAgent) || (/Macintosh/.test(userAgent) && maxTouchPoints > 1)) return 'none'
  if (/Android/i.test(userAgent)) return IN_APP_BROWSER.test(userAgent) || /; wv\)/.test(userAgent) ? 'in-app' : 'badge'
  return /Macintosh|Windows|Linux|CrOS/.test(userAgent) ? 'badge' : 'none'
}

/** Google's official badge artwork as a PNG rendering of its SVG (public/wallet/google/, see its README.txt): en, he, ru, fr, es. */
export function googleWalletBadgePath(lang: string): string {
  return `/wallet/google/${lang}.png`
}

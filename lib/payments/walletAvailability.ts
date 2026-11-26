import type { HostedPaymentParams } from './hostedFieldsProtocol'

// Which express wallets the card step offers. A wallet button shows only when BOTH hold: Tranzila has it enabled on the
// terminal (payment.wallets, from TRANZILA_APPLE_PAY / TRANZILA_GOOGLE_PAY), and this device or browser can use it. With no
// live terminal there is no `payment` at all (the dev sandbox), so there is never a wallet button.
//
//  - Apple Pay: `window.ApplePaySession` exists (Safari on iOS and macOS, every iOS browser). It does not exist in a native
//    app's WebView, so the app's card step offers cards there.
//  - Google Pay: Tranzila's SDK fires `googleIsEnable` once it has detected a usable Google Pay wallet; nothing else decides.
interface ApplePayWindow {
  ApplePaySession?: { canMakePayments?: () => boolean }
}

export function applePayAvailable(wallets: HostedPaymentParams['wallets'] | null | undefined, target: object | undefined): boolean {
  const win = target as ApplePayWindow | undefined
  if (!wallets?.applePay || !win?.ApplePaySession) return false
  try {
    // canMakePayments is sync and only says whether Apple Pay is possible at all; a device without a card still shows the button (Apple's guidance).
    return typeof win.ApplePaySession.canMakePayments === 'function' ? win.ApplePaySession.canMakePayments() !== false : true
  } catch {
    return false
  }
}

export function googlePayAvailable(wallets: HostedPaymentParams['wallets'] | null | undefined, sdkReportedEnabled: boolean): boolean {
  return !!wallets?.googlePay && sdkReportedEnabled
}

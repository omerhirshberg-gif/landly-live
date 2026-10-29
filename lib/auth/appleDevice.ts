// Where Apple leads Google in the sign-in provider row: iPhone and iPad,
// in the native app and in their browsers (the website and the Expo web
// build). Everywhere else Google comes first. No dependencies, so the native
// app can import it.

/**
 * iPhone, iPad and iPod browsers. iPadOS asks for the desktop site by default
 * and reports itself as a Mac, so a Mac with a touch screen counts too.
 */
export function isAppleMobileWeb(userAgent: string | null | undefined, maxTouchPoints = 0): boolean {
  if (!userAgent) return false
  if (/\b(iPhone|iPad|iPod)\b/.test(userAgent)) return true
  return /\bMacintosh\b/.test(userAgent) && maxTouchPoints > 1
}

export type AuthProvider = 'apple' | 'google' | 'passkey'

/**
 * The provider row's order, as rendered (so focus and screen readers follow
 * it; RTL mirrors it on screen): Apple first on iPhone and iPad, Google first
 * everywhere else, the passkey last where it's offered.
 */
export function providerOrder({ appleFirst, apple = true, passkey = false }: { appleFirst: boolean; apple?: boolean; passkey?: boolean }): AuthProvider[] {
  const order: AuthProvider[] = appleFirst ? ['apple', 'google'] : ['google', 'apple']
  return [...order.filter((p) => p !== 'apple' || apple), ...(passkey ? (['passkey'] as const) : [])]
}

// The offer or voucher a landly:// link asked for (app/+native-intent.tsx).
// Those screens sit behind Stack.Protected, so a signed-out member lands on
// sign-in instead; the root layout (app/_layout.tsx) opens the link once they
// are in. A link that already reached its screen is cleared there too, so a
// stale one never reopens after a later sign-in.
let pending: string | null = null

export function rememberDeepLink(path: string) {
  pending = path
}

export function pendingDeepLink(): string | null {
  return pending
}

export function clearPendingDeepLink() {
  pending = null
}

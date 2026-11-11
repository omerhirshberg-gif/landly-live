import 'server-only'
import { randomInt } from 'node:crypto'
import { currentFirebaseDeployTarget } from '@/lib/firebase/envGuard'

// A payment sandbox for environments with no live gateway: orders are stamped
// with this terminal and settled by app/api/payments/dev-sandbox through the
// same claimOfferForOrder transaction the webhook runs.
//  - Local `next dev` without Tranzila credentials: on by default.
//  - Vercel Preview (the dev Firebase project): on only when PAYMENT_SANDBOX=1 is set.
//  - Vercel Production: never, whatever else is set.
//  - Never once a real terminal is configured.
export const DEV_SANDBOX_TERMINAL = 'landly_sandbox'

export function isPaymentSandboxEnabled(): boolean {
  if (process.env.TRANZILA_TERMINAL) return false
  const target = currentFirebaseDeployTarget()
  if (target === 'local') return process.env.NODE_ENV === 'development'
  if (target === 'preview') return process.env.PAYMENT_SANDBOX === '1'
  return false
}

/** A digits-only transaction ID, shaped like a Tranzila `index`. */
export function sandboxTransactionId(): string {
  return `9${Date.now()}${String(randomInt(0, 1000)).padStart(3, '0')}`
}

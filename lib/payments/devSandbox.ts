import 'server-only'
import { randomInt } from 'node:crypto'
import { currentFirebaseDeployTarget } from '@/lib/firebase/envGuard'

// Local `next dev` without Tranzila credentials gets a payment sandbox: orders
// are stamped with this terminal and settled by app/api/payments/dev-sandbox
// through the same claimOfferForOrder transaction the webhook runs. Never on
// Vercel (Preview or Production), never in a production build, and never once
// a real terminal is configured.
export const DEV_SANDBOX_TERMINAL = 'landly_sandbox'

export function isPaymentSandboxEnabled(): boolean {
  return process.env.NODE_ENV === 'development'
    && currentFirebaseDeployTarget() === 'local'
    && !process.env.TRANZILA_TERMINAL
}

/** A digits-only transaction ID, shaped like a Tranzila `index`. */
export function sandboxTransactionId(): string {
  return `9${Date.now()}${String(randomInt(0, 1000)).padStart(3, '0')}`
}

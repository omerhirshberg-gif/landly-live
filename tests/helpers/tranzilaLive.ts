import { vi } from 'vitest'
import { setTranzilaVerifier, type TranzilaTransactionVerifier, type VerifiedTransaction } from '@/lib/payments/verifyTranzilaTransaction'
import { terminal } from './paymentFixtures'

/** The full live credential set (lib/payments/tranzilaConfig.ts) with test values. */
export function stubLiveTranzila() {
  vi.stubEnv('TRANZILA_TERMINAL', terminal)
  vi.stubEnv('TRANZILA_API_APP_KEY', 'app-key')
  vi.stubEnv('TRANZILA_API_SECRET', 'api-secret')
  vi.stubEnv('TRANZILA_WEBHOOK_SECRET', 'test-secret')
  vi.stubEnv('TRANZILA_NOTIFY_ORIGIN', 'https://landly.test')
}

export const verifiedTx: VerifiedTransaction = {
  terminal, tranzilaTxnId: '123', amountAgorot: 1025, currency: 'ILS', tranmode: 'A', approved: true, responseCode: '000', orderId: null,
}

/** A stand-in for Tranzila's own record; `current` is what "Tranzila says" and can be swapped per test. */
export function useFakeVerifier(initial: VerifiedTransaction | null = verifiedTx) {
  const state: { current: VerifiedTransaction | null } = { current: initial }
  const verifier: TranzilaTransactionVerifier = {
    byTransactionId: async (_t, id) => (state.current && state.current.tranzilaTxnId === id ? state.current : null),
    byOrderId: async () => state.current,
  }
  setTranzilaVerifier(verifier)
  return state
}

import 'server-only'
import { createHmac } from 'node:crypto'
import { secretsEqual } from '@/lib/auth/secretCompare'
import { PaymentError } from './paymentValidation'
import { createReportsVerifier } from './reportsVerifier'
import { readTranzilaConfig } from './tranzilaConfig'

// Security finding R2: a notification (or a browser saying "charged") is a CLAIM. Settlement may only follow what Tranzila
// itself says about the transaction. This module is the seam for that check.
//
// FAIL-CLOSED: unless an operator sets TRANZILA_VERIFIER (tranzilaConfig.ts), the active verifier is `failClosedVerifier`,
// which answers 503 and settles nothing. `reports` selects the Reports API lookup (reportsVerifier.ts). `response_hash` settles
// from the signed charge response (responseHashVerifier.ts, via /api/payments/confirm) and has no lookup, so lookups stay
// fail-closed in that mode. Both are off until Tranzila confirms the reference binding / hash format for the approved merchant.
export interface VerifiedTransaction {
  terminal: string
  tranzilaTxnId: string
  amountAgorot: number
  currency: 'ILS'
  tranmode: 'A'
  approved: boolean
  responseCode: string
  /** Our order id if Tranzila echoes it back (request_params / custom field); null when the lookup does not carry it. */
  orderId: string | null
}

export interface TranzilaTransactionVerifier {
  /** The transaction Tranzila holds under this id, or null when it has none. Throws PaymentError(503) when it cannot ask. */
  byTransactionId(terminal: string, tranzilaTxnId: string): Promise<VerifiedTransaction | null>
  /** The latest transaction Tranzila holds for our order, or null when none yet. */
  byOrderId(terminal: string, orderId: string): Promise<VerifiedTransaction | null>
}

export const failClosedVerifier: TranzilaTransactionVerifier = {
  async byTransactionId() { throw new PaymentError('Payment verification is not available yet.', 503) },
  async byOrderId() { throw new PaymentError('Payment verification is not available yet.', 503) },
}

let override: TranzilaTransactionVerifier | null = null
let reports: { key: string; verifier: TranzilaTransactionVerifier } | null = null

/** The verifier for this deployment: a registered one (tests), else what TRANZILA_VERIFIER selects, else fail-closed. */
export function getTranzilaVerifier(): TranzilaTransactionVerifier {
  if (override) return override
  const config = readTranzilaConfig()
  if (!config || config.verifier !== 'reports') return failClosedVerifier
  const key = `${config.terminal}|${config.appKey}|${config.reportsUrl}|${config.orderRefField}`
  if (!reports || reports.key !== key) reports = { key, verifier: createReportsVerifier(config) }
  return reports.verifier
}

/** Registers a lookup in tests (a fake). Pass null to restore the configured verifier. */
export function setTranzilaVerifier(verifier: TranzilaTransactionVerifier | null): void {
  override = verifier
}

/**
 * Hook for the response_hash route (Hosted Fields charge responses): HMAC-SHA256 hex over `canonical`, keyed by the
 * secret Tranzila support issues. How the canonical string is assembled is NOT documented, so the caller must supply it;
 * there is no default on purpose. Constant-time compare.
 */
export function verifyResponseHash(canonical: string, hash: string, secret: string | null | undefined): boolean {
  if (!secret || !canonical || !/^[0-9a-fA-F]{64}$/.test(hash)) return false
  return secretsEqual(hash.toLowerCase(), createHmac('sha256', secret).update(canonical).digest('hex'))
}

export interface ExpectedTransaction { orderId: string; terminal: string; amountAgorot: number; tranzilaTxnId?: string }

/** Every field Tranzila reported must equal what we froze or were told; anything else needs reconciliation, never settlement. */
export function assertMatchesExpected(verified: VerifiedTransaction, expected: ExpectedTransaction): void {
  if (verified.terminal !== expected.terminal || verified.currency !== 'ILS' || verified.tranmode !== 'A'
    || verified.amountAgorot !== expected.amountAgorot
    || (verified.orderId !== null && verified.orderId !== expected.orderId)
    || (expected.tranzilaTxnId !== undefined && verified.tranzilaTxnId !== expected.tranzilaTxnId)) {
    throw new PaymentError('Tranzila transaction does not match the order; reconciliation is required.')
  }
}

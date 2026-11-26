import 'server-only'
import { amountInAgorot, PaymentError } from './paymentValidation'
import { verifyResponseHash, type VerifiedTransaction } from './verifyTranzilaTransaction'

// R2 via the signed Hosted Fields charge response (docs: the top-level `response_hash`, an HMAC over the rest of the response
// JSON, keyed by a secret Tranzila support issues). Opt-in only (TRANZILA_VERIFIER=response_hash); fail-closed by default.
//
// The docs do not say how "the remaining string" is assembled (field order, separators, nesting, JSON serialisation) nor
// whether plain SHA-256 or HMAC-SHA-256 is meant (the only sample is HMAC). So there is NO built-in canonical form: until
// Tranzila confirms it, `setResponseHashCanonicalizer` has not been called, and this verifier answers 503. Once confirmed,
// register the one function below; nothing else changes.
//
// Binding to the order: the response carries no terminal and no order id of its own. The order id must come back signed inside
// `transaction_response.user_form_data.orderId` (the docs say non-hosted fields sent to charge() are echoed there; whether they
// sit inside the hashed payload is one of the questions for Tranzila). The terminal is taken from the order: the Handshake
// (thtk) already bound this charge to that terminal and amount.
export type ResponseCanonicalizer = (responseWithoutHash: Record<string, unknown>) => string

let canonicalizer: ResponseCanonicalizer | null = null

export function setResponseHashCanonicalizer(fn: ResponseCanonicalizer | null): void {
  canonicalizer = fn
}

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)

export interface ChargeResponseContext { orderId: string; terminal: string; secret: string | null }

/** The verified transaction a signed charge response describes; throws PaymentError (503 not ready, 409 not trustworthy). */
export function verifiedFromChargeResponse(raw: unknown, ctx: ChargeResponseContext): VerifiedTransaction {
  if (!ctx.secret) throw new PaymentError('Payment verification is not available yet.', 503)
  if (!canonicalizer) throw new PaymentError('Payment verification is not available yet.', 503)
  if (!isRecord(raw) || typeof raw.response_hash !== 'string') throw new PaymentError('Charge response is not verifiable.', 409)
  const { response_hash: hash, ...rest } = raw
  let canonical: string
  try {
    canonical = canonicalizer(rest)
  } catch {
    throw new PaymentError('Payment verification is not available yet.', 503)
  }
  if (!verifyResponseHash(canonical, hash, ctx.secret)) throw new PaymentError('Charge response signature is invalid; reconciliation is required.', 409)

  const tx = rest.transaction_response
  if (!isRecord(tx)) throw new PaymentError('Charge response is not verifiable.', 409)
  const form = isRecord(tx.user_form_data) ? tx.user_form_data : null
  const orderId = form && typeof form.orderId === 'string' ? form.orderId : null
  // An unsigned-order response cannot be tied to an order.
  if (!orderId) throw new PaymentError('Charge response does not carry the order reference.', 409)
  const txnId = typeof tx.transaction_id === 'number' || typeof tx.transaction_id === 'string' ? String(tx.transaction_id) : ''
  if (!/^\d{1,20}$/.test(txnId)) throw new PaymentError('Charge response is not verifiable.', 409)
  const code = String(tx.processor_response_code ?? '')
  if (!/^\d{1,4}$/.test(code)) throw new PaymentError('Charge response is not verifiable.', 409)
  const currency = String(tx.currency_code)
  if (currency !== 'ILS' && currency !== '1') throw new PaymentError('Tranzila transaction does not match the order; reconciliation is required.')
  const tranmode = tx.tranmode ?? 'A'
  if (tranmode !== 'A') throw new PaymentError('Tranzila transaction does not match the order; reconciliation is required.')
  return {
    terminal: ctx.terminal, tranzilaTxnId: txnId,
    amountAgorot: amountInAgorot(typeof tx.amount === 'number' ? tx.amount : String(tx.amount)),
    currency: 'ILS', tranmode: 'A', approved: tx.success === true && code === '000', responseCode: code, orderId,
  }
}

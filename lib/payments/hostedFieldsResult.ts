import type { CardFrameErrorCode } from './hostedFieldsProtocol'

// Turns the callback of TzlaHostedFields `fields.charge(params, (err, response) => ...)` (and the wallet charges, which share
// its shape) into what the UI shows. This is presentation only: `charged` just tells the host to ask the server to confirm;
// the voucher never depends on it.
//
// Tranzila's own docs disagree on the error shape: the sample reads `err.messages[]`, the Response Keys table calls it
// `errors[]` with `code`, `param` and `message`. Both are read, from `err` or from `response.errors`.
export type ChargeOutcome =
  | { ok: true }
  | { ok: false; code: CardFrameErrorCode; /** Tranzila field names (credit_card_number, expiry, cvv) that failed validation. */ fields: string[] }

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null

// Hosted Fields error codes (docs "Error Messages"): 10000 MANDATORY KEY IS MISSING, 10001 INVALID TERMINAL NAME, 10002 INVALID
// CREDIT CARD NUMBER, 10003 INVALID CVV, 10004 / 10005 INVALID EXPIRATION MONTH / YEAR, 10006 INVALID AMOUNT OR AMOUNT ZERO, 10007
// INVALID PAYMENT PLAN, 10008-10010 installments, 10011 INVALID CARD HOLDER ID NUMBER, 10012 INVALID CURRENCY, 10013 TERMINAL NOT
// FOUND OR BAD CONFIGURATION, 10014 INVALID TRAN MODE, 10015-10016 installments missing. The member can fix these by retyping a field:
const FIELD_OF_CODE: Record<number, string> = { 10002: 'credit_card_number', 10003: 'cvv', 10004: 'expiry', 10005: 'expiry', 10011: 'card_holder_id_number' }
// The others are ours or Tranzila's configuration, not the member's typing.
const KNOWN_CODES = new Set([10000, 10001, 10006, 10007, 10008, 10009, 10010, 10012, 10013, 10014, 10015, 10016])

function errorList(err: unknown, response: unknown): Record<string, unknown>[] {
  const pick = (value: unknown) => (isRecord(value) ? [value.messages, value.errors] : [])
  const candidates = [...pick(err), ...pick(response)]
  for (const c of candidates) if (Array.isArray(c) && c.length > 0) return c.filter(isRecord)
  return []
}

export function classifyChargeResult(err: unknown, response: unknown): ChargeOutcome {
  const list = errorList(err, response)
  if (list.length > 0 || err) {
    const text = list.map((m) => `${String(m.message ?? '')} ${String(m.param ?? '')}`).join(' ').toLowerCase()
    // An expired or amount-mismatched handshake (Tranzila error 912791) is fixed by asking the server for a new thtk.
    if (/thtk|handshake|912791/.test(text)) return { ok: false, code: 'thtk_expired', fields: [] }
    const fields: string[] = []
    let validation = false
    let configuration = false
    for (const m of list) {
      const code = Number(m.code)
      if (code in FIELD_OF_CODE) { validation = true; fields.push(FIELD_OF_CODE[code]) }
      else if (KNOWN_CODES.has(code)) configuration = true
      else if (typeof m.param === 'string' && m.param) { validation = true; fields.push(m.param) }
    }
    if (validation) return { ok: false, code: 'validation', fields: [...new Set(fields)] }
    return { ok: false, code: configuration || list.length === 0 ? 'network' : 'validation', fields: [] }
  }
  const tx = isRecord(response) && isRecord(response.transaction_response) ? response.transaction_response : null
  if (!tx) return { ok: false, code: 'network', fields: [] }
  if (tx.success === true && (tx.processor_response_code === '000' || tx.processor_response_code === '0')) return { ok: true }
  const detail = `${String(tx.error ?? '')} ${String(tx.processor_response_code ?? '')}`.toLowerCase()
  return { ok: false, code: detail.includes('3ds') || detail.includes('3d secure') ? '3ds_failed' : 'declined', fields: [] }
}

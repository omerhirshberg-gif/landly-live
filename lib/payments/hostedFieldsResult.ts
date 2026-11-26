import type { CardFrameErrorCode } from './hostedFieldsProtocol'

// Turns the callback of TzlaHostedFields `fields.charge(params, (err, response) => ...)` into what the UI shows.
// This is presentation only: `charged` just tells the host to ask the server to confirm. The voucher never depends on it.
export type ChargeOutcome =
  | { ok: true }
  | { ok: false; code: CardFrameErrorCode; /** Tranzila field names (credit_card_number, expiry, cvv) that failed validation. */ fields: string[] }

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null

export function classifyChargeResult(err: unknown, response: unknown): ChargeOutcome {
  if (err) {
    const messages = isRecord(err) && Array.isArray(err.messages) ? err.messages.filter(isRecord) : []
    const text = messages.map((m) => `${String(m.message ?? '')} ${String(m.param ?? '')}`).join(' ').toLowerCase()
    // An expired or amount-mismatched handshake (Tranzila error 912791) is fixed by asking the server for a new thtk.
    if (/thtk|handshake|912791/.test(text)) return { ok: false, code: 'thtk_expired', fields: [] }
    const fields = messages.map((m) => (typeof m.param === 'string' ? m.param : '')).filter(Boolean)
    if (messages.length > 0) return { ok: false, code: 'validation', fields }
    return { ok: false, code: 'network', fields: [] }
  }
  const tx = isRecord(response) && isRecord(response.transaction_response) ? response.transaction_response : null
  if (!tx) return { ok: false, code: 'network', fields: [] }
  if (tx.success === true && (tx.processor_response_code === '000' || tx.processor_response_code === '0')) return { ok: true }
  const detail = `${String(tx.error ?? '')} ${String(tx.processor_response_code ?? '')}`.toLowerCase()
  return { ok: false, code: detail.includes('3ds') || detail.includes('3d secure') ? '3ds_failed' : 'declined', fields: [] }
}

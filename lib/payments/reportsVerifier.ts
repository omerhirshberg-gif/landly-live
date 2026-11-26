import 'server-only'
import { amountInAgorot, PaymentError } from './paymentValidation'
import { tranzilaApiHeaders } from './tranzilaApiAuth'
import type { TranzilaLiveConfig } from './tranzilaConfig'
import type { TranzilaTransactionVerifier, VerifiedTransaction } from './verifyTranzilaTransaction'

// R2 via Tranzila's Reports API (docs.tranzila.com/docs/reports/*): after a charge, ask Tranzila what it holds. Opt-in only
// (TRANZILA_VERIFIER=reports); the default stays fail-closed (verifyTranzilaTransaction.ts).
//
// What the docs give us: POST {report host}/v1/transaction with terminal_name plus `transaction_index` or a date range and
// `ufields` filters, answered by `transactions[]` carrying index, amount, currency, processor_response_code, tranmode,
// child_terminal and user_defined_1..25. Auth is the same four-header HMAC as the Handshake (tranzilaApiAuth.ts).
//
// What they do NOT give us, and why this is not enabled by default:
//  - a documented way to put OUR order id on a Hosted Fields transaction. Without it an approved payment cannot be tied to an
//    order (a member could submit someone else's transaction), so this verifier refuses to return anything it cannot bind:
//    it reads the order id from the terminal field named by TRANZILA_ORDER_REF_FIELD and answers 503 when that is empty.
//  - whether the Hosted Fields transaction_id equals the report `index`, the unit of `amount`, what `tranmode` reads for a
//    debit, or the report latency. Every one of these is checked strictly, so a wrong guess fails closed (409/503) and never
//    settles. Confirm them with Tranzila before switching the mode on (docs/payment-and-email-configuration.md).

// Tranzila blocks the sending IP above 30 requests/s or 1,000/min on the report host, and a block lasts at least a minute.
// Serverless instances share egress IPs, so each process stays well under the limit and a 429 stops it asking for a while.
const MAX_PER_SECOND = 25
const MAX_PER_MINUTE = 900
const MAX_WAIT_MS = 2000
const BLOCK_EXTRA_MS = 60_000
const DEFAULT_RETRY_AFTER_S = 60
const REQUEST_TIMEOUT_MS = 5000
const FIELDS_CACHE_MS = 10 * 60_000

export interface ReportsClock { now(): number; sleep(ms: number): Promise<void> }
const realClock: ReportsClock = { now: () => Date.now(), sleep: (ms) => new Promise((r) => setTimeout(r, ms)) }

/** A per-process budget for the report host: a sliding second and minute, and a block after Tranzila's 429. */
export class ReportsRateGuard {
  private stamps: number[] = []
  private blockedUntil = 0
  constructor(private readonly clock: ReportsClock = realClock) {}

  /** Resolves when a request may go out; throws PaymentError(503) when the host is blocked or the wait would be long. */
  async acquire(): Promise<void> {
    for (;;) {
      const now = this.clock.now()
      if (now < this.blockedUntil) throw new PaymentError('Payment verification is rate limited; retry shortly.', 503)
      this.stamps = this.stamps.filter((t) => now - t < 60_000)
      const lastSecond = this.stamps.filter((t) => now - t < 1000)
      let wait = 0
      if (lastSecond.length >= MAX_PER_SECOND) wait = Math.max(wait, 1000 - (now - lastSecond[0]) + 1)
      if (this.stamps.length >= MAX_PER_MINUTE) wait = Math.max(wait, 60_000 - (now - this.stamps[0]) + 1)
      if (wait === 0) { this.stamps.push(now); return }
      if (wait > MAX_WAIT_MS) throw new PaymentError('Payment verification is rate limited; retry shortly.', 503)
      await this.clock.sleep(wait)
    }
  }

  /** Tranzila said 429 (error 20006): stop asking for Retry-After plus the documented minute of recovery. */
  block(retryAfterSeconds: number | null): void {
    const seconds = retryAfterSeconds !== null && Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0 ? retryAfterSeconds : DEFAULT_RETRY_AFTER_S
    this.blockedUntil = this.clock.now() + seconds * 1000 + BLOCK_EXTRA_MS
  }
}

const sharedGuard = new ReportsRateGuard()

export interface ReportsVerifierOptions { fetchImpl?: typeof fetch; guard?: ReportsRateGuard; clock?: ReportsClock }

type Json = Record<string, unknown>
const isRecord = (v: unknown): v is Json => typeof v === 'object' && v !== null && !Array.isArray(v)
const unavailable = (message = 'Payment verification is unavailable.') => new PaymentError(message, 503)
const mismatch = () => new PaymentError('Tranzila transaction does not match the order; reconciliation is required.')

export function createReportsVerifier(config: TranzilaLiveConfig, options: ReportsVerifierOptions = {}): TranzilaTransactionVerifier {
  const fetchImpl = options.fetchImpl ?? fetch
  const guard = options.guard ?? sharedGuard
  const clock = options.clock ?? realClock
  const refField = config.orderRefField
  const fieldIds = new Map<string, { id: number; at: number }>()

  async function post(path: string, body: Json): Promise<Json> {
    await guard.acquire()
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
    let res: Response
    try {
      res = await fetchImpl(`${config.reportsUrl}${path}`, {
        method: 'POST',
        headers: tranzilaApiHeaders(config.appKey, config.apiSecret),
        body: JSON.stringify(body),
        redirect: 'error',
        signal: controller.signal,
      })
    } catch {
      throw unavailable()
    } finally {
      clearTimeout(timer)
    }
    const data = await res.json().catch(() => null) as unknown
    // The docs: while blocked some answers are a non-JSON page; treat any such failure as a 429.
    if (res.status === 429 || (isRecord(data) && data.error_code === 20006) || (!res.ok && !isRecord(data))) {
      guard.block(Number(res.headers.get('Retry-After')) || null)
      throw unavailable('Payment verification is rate limited; retry shortly.')
    }
    if (!res.ok || !isRecord(data)) throw unavailable()
    return data
  }

  /** The terminal's field slot (1..25) for our reference; the listing is cached because the docs ask for it. */
  async function refSlot(terminal: string): Promise<number> {
    if (!refField) throw unavailable('The order reference field is not configured.')
    const cached = fieldIds.get(terminal)
    if (cached && clock.now() - cached.at < FIELDS_CACHE_MS) return cached.id
    const data = await post('/v1/terminals/settings/fields/list', { terminal_name: terminal })
    // The listing's wrapper is not shown in the docs, so look for the array of field records wherever it sits.
    const list = Object.values(data).find((v) => Array.isArray(v) && v.some((f) => isRecord(f) && 'api_parameter_name' in f)) as unknown[] | undefined
    const field = list?.find((f) => isRecord(f) && f.api_parameter_name === refField) as Json | undefined
    const id = Number(field?.field_id)
    if (!Number.isInteger(id) || id < 1 || id > 25) throw unavailable('The order reference field is not configured on the terminal.')
    fieldIds.set(terminal, { id, at: clock.now() })
    return id
  }

  async function toVerified(tx: unknown, slot: number): Promise<VerifiedTransaction> {
    if (!isRecord(tx)) throw unavailable()
    const index = typeof tx.index === 'number' || typeof tx.index === 'string' ? String(tx.index) : ''
    if (!/^\d{1,20}$/.test(index)) throw unavailable()
    // Unit of `amount` is not documented: read it as a decimal in shekels (like the Handshake `sum`); a different unit then
    // fails the amount comparison against the order and is reconciled, never settled.
    const amountAgorot = amountInAgorot(typeof tx.amount === 'number' ? tx.amount : String(tx.amount))
    const currency = String(tx.currency)
    if (currency !== '1' && currency !== 'ILS') throw mismatch()
    if (tx.tranmode !== 'A') throw mismatch()
    const code = typeof tx.processor_response_code === 'string' ? tx.processor_response_code : String(tx.processor_response_code ?? '')
    if (!/^\d{1,4}$/.test(code)) throw unavailable()
    const ref = tx[`user_defined_${slot}`]
    // Never settle what cannot be tied to an order.
    if (typeof ref !== 'string' || ref.length === 0) throw unavailable('Tranzila did not return the order reference.')
    return {
      terminal: typeof tx.child_terminal === 'string' ? tx.child_terminal : '',
      tranzilaTxnId: index, amountAgorot, currency: 'ILS', tranmode: 'A', approved: code === '000', responseCode: code, orderId: ref,
    }
  }

  const transactionsOf = (data: Json): unknown[] => (Array.isArray(data.transactions) ? data.transactions : [])

  return {
    async byTransactionId(terminal, tranzilaTxnId) {
      if (!/^\d{1,20}$/.test(tranzilaTxnId)) return null
      const slot = await refSlot(terminal)
      const data = await post('/v1/transaction', { terminal_name: terminal, transaction_index: Number(tranzilaTxnId), detailed: 'N' })
      const tx = transactionsOf(data).find((t) => isRecord(t) && String(t.index) === tranzilaTxnId)
      return tx ? toVerified(tx, slot) : null
    },

    async byOrderId(terminal, orderId) {
      const slot = await refSlot(terminal)
      const day = 86_400_000
      const date = (offsetDays: number) => new Date(clock.now() + offsetDays * day).toISOString().slice(0, 10)
      const data = await post('/v1/transaction', {
        terminal_name: terminal, transaction_start_date: date(-1), transaction_end_date: date(1), detailed: 'N',
        page: 1, page_results: 50, order_direction: 'desc',
        ufields: [{ name: refField, operator: 'equals', value: orderId }],
      })
      const found: VerifiedTransaction[] = []
      for (const tx of transactionsOf(data)) {
        const verified = await toVerified(tx, slot)
        // The filter is Tranzila's; the order id on the record is checked again here.
        if (verified.orderId === orderId) found.push(verified)
      }
      const approved = found.filter((t) => t.approved)
      // Two approved charges for one order is a double charge: a person reconciles it, nothing settles.
      if (approved.length > 1) throw mismatch()
      if (approved.length === 1) return approved[0]
      // Newest first (order_direction desc): the latest attempt is the answer for a declined order.
      return found[0] ?? null
    },
  }
}

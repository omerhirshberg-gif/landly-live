import 'server-only'
import {
  SupplierNotConfiguredError, SupplierRequestError, SupplierUnsupportedError, withRetry,
  type BalanceResult, type IssuedCode, type OrderItem, type SupplierAdapter, type SupplierBusiness, type SupplierRedemption,
} from './SupplierAdapter'

// SKELETON. Multipass's API contract and credentials have not been received, so the paths and payload shapes below are
// placeholders marked PLACEHOLDER; they are the single place to change when the spec arrives. Until then every call fails
// closed with SupplierNotConfiguredError (MULTIPASS_ENABLED must be '1' AND the base URL and key set). Secrets come only from
// env vars. Codes are never logged: errors carry the supplier name and HTTP status only.
//
//   MULTIPASS_ENABLED=1   MULTIPASS_API_BASE_URL=https://...   MULTIPASS_API_KEY=...
//
// Every mutating call sends `Idempotency-Key: <externalEventId>`, so a retry (or a replayed webhook) never issues twice.

const NAME = 'multipass'

export interface MultipassConfig { baseUrl: string; apiKey: string }

export function multipassConfig(env: NodeJS.ProcessEnv = process.env): MultipassConfig | null {
  if (env.MULTIPASS_ENABLED !== '1') return null
  const baseUrl = env.MULTIPASS_API_BASE_URL?.trim().replace(/\/+$/, '')
  const apiKey = env.MULTIPASS_API_KEY?.trim()
  return baseUrl && apiKey ? { baseUrl, apiKey } : null
}

export const isMultipassConfigured = (env: NodeJS.ProcessEnv = process.env) => multipassConfig(env) !== null

export class MultipassAdapter implements SupplierAdapter {
  readonly id = 'multipass' as const
  constructor(private readonly deps: { fetcher?: typeof fetch; config?: MultipassConfig | null; sleep?: (ms: number) => Promise<void> } = {}) {}

  private config(): MultipassConfig {
    const c = this.deps.config === undefined ? multipassConfig() : this.deps.config
    if (!c) throw new SupplierNotConfiguredError(NAME, 'the API (MULTIPASS_ENABLED, MULTIPASS_API_BASE_URL, MULTIPASS_API_KEY)')
    return c
  }

  private async request<T>(method: 'GET' | 'POST', path: string, body?: unknown, idempotencyKey?: string): Promise<T> {
    const { baseUrl, apiKey } = this.config()
    return withRetry(async () => {
      const res = await (this.deps.fetcher ?? fetch)(`${baseUrl}${path}`, {
        method,
        headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json', ...(idempotencyKey ? { 'idempotency-key': idempotencyKey } : {}) },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.timeout(20_000),
      })
      if (!res.ok) throw new SupplierRequestError(NAME, res.status)
      return (await res.json()) as T
    }, { sleep: this.deps.sleep })
  }

  async importStock(): Promise<never> {
    throw new SupplierUnsupportedError(NAME, 'stock import (it issues at the sale)')
  }

  /** PLACEHOLDER path and shape. Idempotent by the order item's externalEventId. */
  async issue(item: OrderItem): Promise<IssuedCode> {
    const out = await this.request<{ code?: string; id?: string; expiresAt?: string }>('POST', '/vouchers/issue', {
      orderId: item.orderId, productId: item.productId, amount: item.faceValueAgorot / 100, businessId: item.businessId ?? null,
    }, item.externalEventId)
    if (!out.code || !out.id) throw new SupplierRequestError(NAME, 502)
    return { code: out.code, supplierRef: out.id, expiresAt: out.expiresAt ? new Date(out.expiresAt) : null }
  }

  /** PLACEHOLDER. */
  async checkBalance(ref: { code?: string; supplierRef?: string }): Promise<BalanceResult> {
    if (!ref.supplierRef && !ref.code) throw new SupplierUnsupportedError(NAME, 'a balance check without a reference')
    const out = await this.request<{ balance: number }>('GET', `/vouchers/${encodeURIComponent(ref.supplierRef ?? '')}/balance`)
    return { balanceAgorot: Math.round(Number(out.balance) * 100), source: 'supplier' }
  }

  /** PLACEHOLDER. */
  async getRedemptions(since: Date): Promise<SupplierRedemption[]> {
    const out = await this.request<{ items: { id: string; voucherId: string; amount: number; businessId?: string; at: string }[] }>('GET', `/redemptions?since=${encodeURIComponent(since.toISOString())}`)
    return out.items.map((i) => ({ externalEventId: i.id, supplierRef: i.voucherId, amountAgorot: Math.round(i.amount * 100), businessId: i.businessId ?? null, occurredAt: new Date(i.at) }))
  }

  /** PLACEHOLDER. */
  async voidCode(ref: { supplierRef?: string }, reason: string): Promise<{ confirmed: boolean }> {
    if (!ref.supplierRef) throw new SupplierUnsupportedError(NAME, 'a void without the supplier reference')
    const out = await this.request<{ voided?: boolean }>('POST', `/vouchers/${encodeURIComponent(ref.supplierRef)}/void`, { reason }, `void:${ref.supplierRef}`)
    return { confirmed: out.voided === true }
  }

  /** PLACEHOLDER. */
  async syncBusinesses(): Promise<SupplierBusiness[]> {
    const out = await this.request<{ items: { id: string; name: string; active?: boolean }[] }>('GET', '/businesses')
    return out.items.map((b) => ({ externalId: b.id, name: b.name, active: b.active !== false }))
  }
}

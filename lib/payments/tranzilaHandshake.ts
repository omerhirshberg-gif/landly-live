import 'server-only'
import { PaymentError } from './paymentValidation'
import type { TranzilaLiveConfig } from './tranzilaConfig'
import { tranzilaApiHeaders } from './tranzilaApiAuth'

export interface HandshakeRequest { terminal: string; amountAgorot: number; orderId: string }
export interface HandshakeResult { thtk: string; expiresAtMs: number }

// Tranzila keeps a thtk for 20 minutes; the client is told 19 so it refreshes before the charge could be refused.
const THTK_LIFETIME_MS = 19 * 60 * 1000
const TIMEOUT_MS = 5000

/**
 * Handshake V2: binds one amount to one terminal. `sum` comes from the order's frozen amountAgorot, never from the
 * client; Tranzila refuses a charge whose amount differs from it (error 912791). No retry: a failure is a 503 and the
 * member taps Pay again. Neither the thtk nor the credentials are ever logged.
 */
export async function requestHandshake(
  request: HandshakeRequest, config: TranzilaLiveConfig, fetchImpl: typeof fetch = fetch,
): Promise<HandshakeResult> {
  if (!Number.isSafeInteger(request.amountAgorot) || request.amountAgorot <= 0) throw new PaymentError('Invalid payment amount.', 400)
  if (request.terminal !== config.terminal) throw new PaymentError('Unexpected payment terminal.', 503)
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  let res: Response
  try {
    res = await fetchImpl(config.handshakeUrl, {
      method: 'POST',
      headers: tranzilaApiHeaders(config.appKey, config.apiSecret),
      body: JSON.stringify({ terminal_name: request.terminal, sum: request.amountAgorot / 100, request_params: { orderId: request.orderId } }),
      redirect: 'error',
      signal: controller.signal,
    })
  } catch {
    throw new PaymentError('Payment handshake is unavailable.', 503)
  } finally {
    clearTimeout(timer)
  }
  const data = await res.json().catch(() => null) as { error_code?: unknown; thtk?: unknown } | null
  if (!res.ok || !data || data.error_code !== 0 || typeof data.thtk !== 'string' || !/^[A-Za-z0-9]{8,128}$/.test(data.thtk)) {
    throw new PaymentError('Payment handshake was refused.', 503)
  }
  return { thtk: data.thtk, expiresAtMs: Date.now() + THTK_LIFETIME_MS }
}

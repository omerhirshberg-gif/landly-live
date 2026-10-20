import { normalizeApiBaseUrl } from '@/lib/apiOrigin'
import type { OfferTranslations } from '@/lib/offers/offerText'
import type { BusinessTranslations } from '@/lib/business/businessText'

// What /api/payments/initiate returns: the order as frozen when it was created.
export interface CheckoutOrder {
  orderId: string
  amount: number
  originalPrice: number | null
  offerTitle: string
  businessName: string
  validityDays: number
  redemptionTerms: string
  /** The offer's translations, frozen with the order (lib/offers/offerText.ts); null for older orders. */
  translations?: OfferTranslations | null
  /** The business name in other languages, frozen with the order; null for older orders. */
  businessTranslations?: BusinessTranslations | null
  termsAccepted: boolean
  /** A local development sandbox order (lib/payments/devSandbox.ts). */
  sandbox: boolean
  /** A sandbox order left unfinished earlier, picked up again. */
  resumed: boolean
}

/**
 * unauthorized -- the session expired or the email isn't verified (401/403)
 * conflict     -- the server refused the order (409): already claimed, sold
 *                 out, expired or awaiting reconciliation
 * rateLimited  -- too many tries; wait a minute
 * failed       -- any other answer, or a redirect
 * offline      -- no answer: no connection, CORS block or the timeout
 */
export type CheckoutFailure = 'unauthorized' | 'conflict' | 'rateLimited' | 'failed' | 'offline'

export type CheckoutResult<T> = { ok: true; data: T } | { ok: false; reason: CheckoutFailure; message: string | null }

export const CHECKOUT_TIMEOUT_MS = 20_000

// Client-side caller for the payment routes, for the app (passes API_BASE_URL;
// the website calls them same-origin from app/checkout). Same transport rules
// as lib/account/revokeSessions.ts: redirects are reported as 'failed' (one to
// another host would drop the Authorization header), and the timeout uses
// setTimeout + AbortController for Hermes. Payment is never confirmed here:
// the voucher exists only once the server settles the order (the Tranzila
// webhook, or the dev sandbox through the same transaction).
async function post<T>(apiBaseUrl: string, path: string, idToken: string, body: object): Promise<CheckoutResult<T>> {
  const base = normalizeApiBaseUrl(apiBaseUrl)
  const url = `${base}${path}`
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), CHECKOUT_TIMEOUT_MS)
  let res: Response
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
      body: JSON.stringify(body),
      redirect: 'manual',
      signal: controller.signal,
    })
  } catch {
    return { ok: false, reason: 'offline', message: null }
  } finally {
    clearTimeout(timer)
  }
  const redirected = res.type === 'opaqueredirect' || (res.status >= 300 && res.status < 400) || (!!base && !!res.url && res.url !== url)
  if (redirected) return { ok: false, reason: 'failed', message: null }
  // A non-JSON error page (a proxy, a crashed dev server) still reads as an error.
  const data = await res.json().catch(() => null)
  if (res.ok && data) return { ok: true, data: data as T }
  const message = typeof data?.error === 'string' ? data.error : null
  const reason: CheckoutFailure =
    res.status === 401 || res.status === 403 ? 'unauthorized'
      : res.status === 409 ? 'conflict'
        : res.status === 429 ? 'rateLimited'
          : 'failed'
  return { ok: false, reason, message }
}

/**
 * Creates the member's pending order for an offer, or reads it back unchanged
 * (idempotent). `acceptTerms` comes from the Pay tap -- the clickwrap line
 * above it -- and stamps termsAcceptedAt on the order.
 */
export function initiateCheckout(
  idToken: string,
  offerId: string,
  { acceptTerms = false }: { acceptTerms?: boolean } = {},
  apiBaseUrl = ''
): Promise<CheckoutResult<CheckoutOrder>> {
  return post<CheckoutOrder>(apiBaseUrl, '/api/payments/initiate', idToken, { offerId, ...(acceptTerms && { acceptTerms: true }) })
}

/**
 * Local development only: settles a sandbox order (CheckoutOrder.sandbox) the
 * way the Tranzila webhook would. On approval the voucher, whose id is the
 * order's id, exists by the time this resolves.
 */
export function settleSandboxOrder(
  idToken: string,
  orderId: string,
  outcome: 'approve' | 'decline',
  apiBaseUrl = ''
): Promise<CheckoutResult<{ orderId: string }>> {
  return post<{ orderId: string }>(apiBaseUrl, '/api/payments/dev-sandbox', idToken, { orderId, outcome })
}

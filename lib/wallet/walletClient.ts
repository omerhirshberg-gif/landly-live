import { normalizeApiBaseUrl } from '../apiOrigin'
import type { TranslationKey } from '../i18n/translations'

// The clients' side of app/api/wallet/apple: the website passes '' (same
// origin), the app its API_BASE_URL. Same transport rules as
// lib/payments/checkoutClient.ts: no redirects (one to another host would drop
// the Authorization header) and a setTimeout + AbortController for Hermes.

export type WalletFailure =
  | 'unauthorized' | 'notFound' | 'notEligible' | 'rateLimited' | 'unavailable' | 'offline'
  | 'passDownload' | 'passInvalid'
export type WalletPassLink = { ok: true; url: string; mock: boolean } | { ok: false; reason: WalletFailure }

const TIMEOUT_MS = 15_000

async function request(url: string, init: RequestInit): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    return await fetch(url, { ...init, redirect: 'manual', signal: controller.signal })
  } finally {
    clearTimeout(timer)
  }
}

/**
 * The pass URL on the host this client just reached. The server can't tell:
 * `next dev` reports localhost in request.url whoever calls it, and on a phone
 * localhost is the phone. A regex rather than URL, for React Native.
 */
export function rebasePassUrl(url: string, apiBaseUrl: string): string {
  return `${normalizeApiBaseUrl(apiBaseUrl)}${url.replace(/^[a-z][a-z\d+.-]*:\/\/[^/?#]*/i, '')}`
}

/** A rejection from the app's AppleWallet module (modules/apple-wallet). */
export function nativePassFailure(code: unknown): WalletFailure {
  if (code === 'ERR_PASS_NETWORK') return 'offline'
  if (code === 'ERR_PASS_HTTP') return 'passDownload'
  if (code === 'ERR_PASS_INVALID') return 'passInvalid'
  return 'unavailable'
}

/** What the member reads: they can act on these two, and everything else is "try again". */
export function walletFailureMessage(reason: WalletFailure): TranslationKey {
  if (reason === 'offline') return 'wallet_add_error_offline'
  if (reason === 'rateLimited') return 'wallet_add_error_rate_limited'
  return 'wallet_add_error'
}

/** Whether to show the badge at all. Any doubt reads as no: nothing is shown that can't work. */
export async function fetchWalletAvailability(apiBaseUrl: string): Promise<boolean> {
  try {
    const res = await request(`${normalizeApiBaseUrl(apiBaseUrl)}/api/wallet/apple/availability`, { method: 'GET' })
    const data = await res.json().catch(() => null)
    return res.ok && data?.available === true
  } catch {
    return false
  }
}

/** A short-lived URL for this voucher's .pkpass; `mock` when the server has no certificates (local development). */
export async function requestWalletPass(idToken: string, voucherId: string, apiBaseUrl: string): Promise<WalletPassLink> {
  let res: Response
  try {
    res = await request(`${normalizeApiBaseUrl(apiBaseUrl)}/api/wallet/apple/${encodeURIComponent(voucherId)}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${idToken}` },
    })
  } catch {
    return { ok: false, reason: 'offline' }
  }
  const data = await res.json().catch(() => null)
  if (res.ok && typeof data?.url === 'string') return { ok: true, url: rebasePassUrl(data.url, apiBaseUrl), mock: data.mock === true }
  if (res.status === 401 || res.status === 403) return { ok: false, reason: 'unauthorized' }
  if (res.status === 404) return { ok: false, reason: 'notFound' }
  if (res.status === 409) return { ok: false, reason: 'notEligible' }
  if (res.status === 429) return { ok: false, reason: 'rateLimited' }
  return { ok: false, reason: 'unavailable' }
}

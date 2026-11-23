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

export type WalletProvider = 'apple' | 'google'

/** Whether to show the badge at all. Any doubt reads as no: nothing is shown that can't work. */
export async function fetchWalletAvailability(apiBaseUrl: string, provider: WalletProvider = 'apple'): Promise<boolean> {
  try {
    const res = await request(`${normalizeApiBaseUrl(apiBaseUrl)}/api/wallet/${provider}/availability`, { method: 'GET' })
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
  return { ok: false, reason: failureForStatus(res.status) }
}

function failureForStatus(status: number): WalletFailure {
  if (status === 401 || status === 403) return 'unauthorized'
  if (status === 404) return 'notFound'
  if (status === 409) return 'notEligible'
  if (status === 429) return 'rateLimited'
  return 'unavailable'
}

/** The Google Wallet save link for this voucher (https://pay.google.com/gp/v/save/...), opened as is: Google's own page or app takes over. */
export async function requestGoogleWalletLink(idToken: string, voucherId: string, apiBaseUrl: string): Promise<{ ok: true; url: string } | { ok: false; reason: WalletFailure }> {
  let res: Response
  try {
    res = await request(`${normalizeApiBaseUrl(apiBaseUrl)}/api/wallet/google/${encodeURIComponent(voucherId)}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${idToken}` },
    })
  } catch {
    return { ok: false, reason: 'offline' }
  }
  const data = await res.json().catch(() => null)
  // Only Google's own save page is ever opened, whatever the server sent.
  if (res.ok && typeof data?.url === 'string' && data.url.startsWith('https://pay.google.com/gp/v/save/')) return { ok: true, url: data.url }
  return { ok: false, reason: res.ok ? 'unavailable' : failureForStatus(res.status) }
}

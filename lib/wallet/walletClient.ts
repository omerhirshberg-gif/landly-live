import { normalizeApiBaseUrl } from '../apiOrigin'

// The clients' side of app/api/wallet/apple: the website passes '' (same
// origin), the app its API_BASE_URL. Same transport rules as
// lib/payments/checkoutClient.ts: no redirects (one to another host would drop
// the Authorization header) and a setTimeout + AbortController for Hermes.

export type WalletFailure = 'unauthorized' | 'notFound' | 'notEligible' | 'rateLimited' | 'unavailable' | 'offline'
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
  if (res.ok && typeof data?.url === 'string') return { ok: true, url: data.url, mock: data.mock === true }
  if (res.status === 401 || res.status === 403) return { ok: false, reason: 'unauthorized' }
  if (res.status === 404) return { ok: false, reason: 'notFound' }
  if (res.status === 409) return { ok: false, reason: 'notEligible' }
  if (res.status === 429) return { ok: false, reason: 'rateLimited' }
  return { ok: false, reason: 'unavailable' }
}

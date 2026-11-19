import { normalizeApiBaseUrl } from '../apiOrigin'

// The clients' side of app/api/vouchers/[voucherId]/mark-used: the website passes '' (same origin),
// the app its API_BASE_URL. No redirects (one to another host would drop the Authorization header).
const TIMEOUT_MS = 15_000

/** Tells the server the member used their code-only voucher. True when it was recorded. */
export async function markVoucherUsed(idToken: string, voucherId: string, apiBaseUrl: string): Promise<boolean> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    const res = await fetch(`${normalizeApiBaseUrl(apiBaseUrl)}/api/vouchers/${encodeURIComponent(voucherId)}/mark-used`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${idToken}` },
      redirect: 'manual',
      signal: controller.signal,
    })
    return res.ok
  } catch {
    return false
  } finally {
    clearTimeout(timer)
  }
}

// Unsubscribes an address across the whole Rav Messer account. For scripts,
// which can't import lib/responder (server-only TypeScript); the token exchange
// is the same one lib/responder/client.ts makes.
const BASE = (process.env.RESPONDER_API_BASE?.trim() || 'https://graph.responder.live/v2').replace(/\/+$/, '')
const TIMEOUT_MS = 10_000

async function post(path, body, token) {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  })
  const text = await res.text()
  try {
    return { ok: res.ok, status: res.status, body: JSON.parse(text) }
  } catch {
    return { ok: res.ok, status: res.status, body: null }
  }
}

/** Throws if the settings are missing or Rav Messer doesn't confirm, so the caller stops. */
export async function unsubscribeFromResponder(email) {
  const client_id = process.env.RESPONDER_CLIENT_ID?.trim() || process.env.RESPONDER_CLIENT_KEY?.trim()
  const client_secret = process.env.RESPONDER_CLIENT_SECRET?.trim()
  const user_token = process.env.RAV_MESSER_USER_TOKEN?.trim() || process.env.RESPONDER_USER_TOKEN?.trim()
  if (!client_id || !client_secret || !user_token) throw new Error('Rav Messer credentials are not set.')

  const auth = await post('/oauth/token', { client_id, client_secret, user_token, grant_type: 'client_credentials' })
  if (!auth.ok || typeof auth.body?.token !== 'string') throw new Error(`Rav Messer refused the token request (${auth.status}).`)
  const result = await post('/req/unsubscribe', { email }, auth.body.token)
  if (!result.ok || result.body?.status !== true) throw new Error(`Rav Messer refused the unsubscribe (${result.status}).`)
}

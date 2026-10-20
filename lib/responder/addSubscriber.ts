import 'server-only'
import { createHash, randomBytes } from 'node:crypto'

// Adds a member who opted into marketing to the Responder (Rav-Messer) list.
// Responder Live publishes no API docs of its own, so this targets the
// documented REST API (github.com/responder/restapi): POST a form field
// `subscribers` holding a JSON array, answered 200 with per-address buckets
// (SUBSCRIBERS_CREATED, EMAILS_EXISTING, ...). It authenticates with the
// user token as a Bearer first; if that's refused and the full key set is
// configured, it retries once with the documented signed header.
// Never throws: a missing setting is a silent no-op, anything else one log
// line with the uid and status -- never the address or the response body,
// which echoes addresses back.

const DEFAULT_API_BASE = 'https://api.responder.co.il/main'
const TIMEOUT_MS = 10_000

export type ResponderOutcome = 'created' | 'existing' | 'skipped' | 'failed'

type Step = 'request' | 'http' | 'rejected'

function logFailure(step: Step, uid: string, detail: Record<string, unknown> = {}) {
  console.error(`[responder] step=${step}`, JSON.stringify({ step, uid, ...detail }))
}

const md5 = (value: string) => createHash('md5').update(value).digest('hex')

// The documented header: c_key, c_secret, u_key, u_secret, nonce, timestamp,
// each url-encoded and comma-separated; the secrets are md5(secret + nonce).
function signedAuthorization(clientId: string, clientSecret: string, userToken: string, userSecret: string) {
  const nonce = randomBytes(16).toString('hex')
  const parts = {
    c_key: clientId,
    c_secret: md5(clientSecret + nonce),
    u_key: userToken,
    u_secret: md5(userSecret + nonce),
    nonce,
    timestamp: String(Math.floor(Date.now() / 1000)),
  }
  return Object.entries(parts).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join(',')
}

const count = (v: unknown) => (Array.isArray(v) ? v.length : v && typeof v === 'object' ? Object.keys(v).length : 0)

export async function addSubscriber({ uid, email, firstName }: { uid: string; email: string; firstName: string }): Promise<ResponderOutcome> {
  const env = (name: string) => process.env[name]?.trim() ?? ''
  const listId = env('RESPONDER_LIST_ID')
  const userToken = env('RESPONDER_USER_TOKEN')
  if (!/^\d+$/.test(listId) || !userToken || !email) return 'skipped'
  const clientId = env('RESPONDER_CLIENT_ID')
  const clientSecret = env('RESPONDER_CLIENT_SECRET')
  const userSecret = env('RESPONDER_USER_SECRET')
  const canSign = Boolean(clientId && clientSecret && userSecret)

  const url = `${(env('RESPONDER_API_BASE') || DEFAULT_API_BASE).replace(/\/+$/, '')}/lists/${listId}/subscribers`
  // NOTIFY 0: don't email the list owner about every sign-up.
  const body = new URLSearchParams({ subscribers: JSON.stringify([{ EMAIL: email, NAME: firstName.trim(), NOTIFY: 0 }]) })

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  const post = (authorization: string) =>
    fetch(url, {
      method: 'POST',
      headers: { Authorization: authorization, 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
      body,
      signal: controller.signal,
    })

  try {
    let res = await post(`Bearer ${userToken}`)
    if ((res.status === 401 || res.status === 403) && canSign) {
      res = await post(signedAuthorization(clientId, clientSecret, userToken, userSecret))
    }
    // Some APIs answer a duplicate with 409; the documented one uses EMAILS_EXISTING.
    if (res.status === 409) return 'existing'
    if (!res.ok) {
      logFailure('http', uid, { status: res.status, signed: canSign })
      return 'failed'
    }
    const data = (await res.json().catch(() => null)) as Record<string, unknown> | null
    if (count(data?.SUBSCRIBERS_CREATED) > 0) return 'created'
    if (count(data?.EMAILS_EXISTING) > 0) return 'existing'
    logFailure('rejected', uid, {
      status: res.status,
      invalid: count(data?.EMAILS_INVALID),
      banned: count(data?.EMAILS_BANNED),
      errors: count(data?.ERRORS),
    })
    return 'failed'
  } catch (err) {
    const e = err as { name?: unknown; code?: unknown } | null
    logFailure('request', uid, { code: controller.signal.aborted ? 'timeout' : e?.code ?? e?.name })
    return 'failed'
  } finally {
    clearTimeout(timer)
  }
}

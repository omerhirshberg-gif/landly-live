import 'server-only'

// Adds a member who opted into marketing to the Responder Live (Rav-Messer)
// list. Responder Live publishes no API docs; this is the flow its graph API
// answers to: exchange the account's client id/secret and user token for a
// JWT (POST /oauth/token), then create the subscriber with it
// (POST /subscribers, list_ids placing it in the list). That answers 200
// either way: {status: true, duplicate, createdId} on success -- duplicate
// true for an address already there -- and {status: false} when it refuses
// (an unknown field, for one). The legacy api.responder.co.il API rejects
// these credentials ("Invalid consumer key"), so it isn't tried.
// Never throws: a missing setting is a silent no-op, anything else one log
// line with the uid, status and Responder's own message -- any address in
// that message is masked, and the member's name is never logged.

const DEFAULT_API_BASE = 'https://graph.responder.live/v2'
const TIMEOUT_MS = 10_000

export type ResponderOutcome = 'created' | 'existing' | 'skipped' | 'failed'

type Step = 'token' | 'http' | 'request'

const EMAIL_PATTERN = /[^\s"'<>@,;:]+@[^\s"'<>@,;:]+/g

// Responder's error payloads look like {message, data, code}; `data` is a
// string or a list of strings.
function responderError(body: unknown): Record<string, unknown> {
  if (typeof body === 'string') return { message: sanitize(body) }
  if (!body || typeof body !== 'object') return {}
  const { message, data, code, error } = body as Record<string, unknown>
  const text = (v: unknown) => (v == null || v === '' ? undefined : sanitize(typeof v === 'string' ? v : JSON.stringify(v)))
  return { message: text(message) ?? text(error), data: text(data), code: typeof code === 'number' || typeof code === 'string' ? code : undefined }
}

function sanitize(text: string) {
  return text.replace(EMAIL_PATTERN, '<email>').slice(0, 300)
}

function logFailure(step: Step, uid: string, detail: Record<string, unknown> = {}) {
  console.error(`[responder] step=${step}`, JSON.stringify({ step, uid, ...detail }))
}

async function readBody(res: Response): Promise<unknown> {
  const text = await res.text().catch(() => '')
  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}

export async function addSubscriber({ uid, email, firstName }: { uid: string; email: string; firstName: string }): Promise<ResponderOutcome> {
  const env = (name: string) => process.env[name]?.trim() ?? ''
  const listId = env('RESPONDER_LIST_ID')
  const clientId = env('RESPONDER_CLIENT_ID') || env('RESPONDER_CLIENT_KEY')
  const clientSecret = env('RESPONDER_CLIENT_SECRET')
  const userToken = env('RESPONDER_USER_TOKEN')
  if (!/^\d+$/.test(listId) || !clientId || !clientSecret || !userToken || !email) return 'skipped'

  const base = (env('RESPONDER_API_BASE') || DEFAULT_API_BASE).replace(/\/+$/, '')
  // One deadline for both calls.
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  const post = (path: string, body: unknown, token?: string) =>
    fetch(`${base}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    })

  try {
    const auth = await post('/oauth/token', { client_id: clientId, client_secret: clientSecret, user_token: userToken, grant_type: 'client_credentials' })
    const authBody = await readBody(auth)
    const token = (authBody as { token?: unknown } | null)?.token
    if (!auth.ok || typeof token !== 'string' || !token) {
      logFailure('token', uid, { status: auth.status, ...responderError(authBody) })
      return 'failed'
    }

    const res = await post('/subscribers', { email, first: firstName.trim(), list_ids: [Number(listId)] }, token)
    const body = await readBody(res)
    const result = body as { status?: unknown; duplicate?: unknown } | null
    if (res.ok && result?.status === true) return result.duplicate === true ? 'existing' : 'created'
    logFailure('http', uid, { status: res.status, accepted: result?.status ?? null, ...responderError(body) })
    return 'failed'
  } catch (err) {
    const e = err as { name?: unknown; code?: unknown } | null
    logFailure('request', uid, { code: controller.signal.aborted ? 'timeout' : e?.code ?? e?.name })
    return 'failed'
  } finally {
    clearTimeout(timer)
  }
}

import 'server-only'

// The one place that reads and validates Tranzila's environment. Zero-code switchover: with TRANZILA_TERMINAL unset
// nothing here is live and the dev sandbox (devSandbox.ts) decides; set the terminal and the full credential set and
// checkout runs on Hosted Fields. The dev and production deployments use the same variable names with their own values.
//
//  TRANZILA_TERMINAL         the terminal name (also the order's `terminal`)
//  TRANZILA_API_APP_KEY      Tranzila API application key (X-tranzila-api-app-key)
//  TRANZILA_API_SECRET       the key's secret; signs every API call, never leaves the server
//  TRANZILA_WEBHOOK_SECRET   HMAC key for the signed notify_url token (and the optional notify header)
//  TRANZILA_HANDSHAKE_URL    optional override, https only
//  TRANZILA_NOTIFY_ORIGIN    optional https origin Tranzila posts Notify to (default: the production API host, or this Vercel deployment)
//  TRANZILA_RESPONSE_HASH_SECRET  optional, only for the response_hash verifier once Tranzila confirms its format
export const DEFAULT_HANDSHAKE_URL = 'https://api.tranzila.com/v2/handshake/create'

export class TranzilaConfigError extends Error {
  readonly status = 503
}

export interface TranzilaLiveConfig {
  terminal: string
  appKey: string
  apiSecret: string
  webhookSecret: string
  handshakeUrl: string
  responseHashSecret: string | null
}

type Env = Record<string, string | undefined>

const SECRETISH = /(SECRET|KEY|PASSWORD|PASS|PW|TOKEN)/i

function httpsUrl(value: string, name: string): URL {
  let url: URL
  try {
    url = new URL(value)
  } catch {
    throw new TranzilaConfigError(`${name} is not a valid URL.`)
  }
  if (url.protocol !== 'https:') throw new TranzilaConfigError(`${name} must be https.`)
  return url
}

/** Null when no real terminal is configured (sandbox or off); the validated live settings otherwise; throws when half-configured. */
export function readTranzilaConfig(env: Env = process.env): TranzilaLiveConfig | null {
  // Secrets must never be inlined into the browser bundle.
  for (const name of Object.keys(env)) {
    if (name.startsWith('NEXT_PUBLIC_TRANZILA') && SECRETISH.test(name)) {
      throw new TranzilaConfigError(`${name} must not be a NEXT_PUBLIC_ variable: it would ship to every browser.`)
    }
  }
  const terminal = env.TRANZILA_TERMINAL
  if (!terminal) return null
  if (!/^[A-Za-z0-9_-]{1,100}$/.test(terminal)) throw new TranzilaConfigError('TRANZILA_TERMINAL is malformed.')
  if (env.PAYMENT_SANDBOX === '1') {
    throw new TranzilaConfigError('PAYMENT_SANDBOX=1 cannot be combined with a live TRANZILA_TERMINAL.')
  }
  const missing = ['TRANZILA_API_APP_KEY', 'TRANZILA_API_SECRET', 'TRANZILA_WEBHOOK_SECRET'].filter((name) => !env[name])
  if (missing.length > 0) throw new TranzilaConfigError(`TRANZILA_TERMINAL is set but ${missing.join(', ')} ${missing.length > 1 ? 'are' : 'is'} missing.`)
  const handshakeUrl = env.TRANZILA_HANDSHAKE_URL || DEFAULT_HANDSHAKE_URL
  const handshake = httpsUrl(handshakeUrl, 'TRANZILA_HANDSHAKE_URL')
  if (!handshake.hostname.endsWith('tranzila.com')) throw new TranzilaConfigError('TRANZILA_HANDSHAKE_URL must be a tranzila.com host.')
  return {
    terminal,
    appKey: env.TRANZILA_API_APP_KEY!,
    apiSecret: env.TRANZILA_API_SECRET!,
    webhookSecret: env.TRANZILA_WEBHOOK_SECRET!,
    handshakeUrl,
    responseHashSecret: env.TRANZILA_RESPONSE_HASH_SECRET || null,
  }
}

/** The live settings, for a path that only exists with a real terminal. Throws (503) when there is none. */
export function requireTranzilaConfig(env: Env = process.env): TranzilaLiveConfig {
  const config = readTranzilaConfig(env)
  if (!config) throw new TranzilaConfigError('Payment terminal is not configured.')
  return config
}

/** The public origin Tranzila posts Notify to. Never derived from the request's Host header. */
export function notifyOrigin(env: Env = process.env): string {
  if (env.TRANZILA_NOTIFY_ORIGIN) return httpsUrl(env.TRANZILA_NOTIFY_ORIGIN, 'TRANZILA_NOTIFY_ORIGIN').origin
  if (env.VERCEL_ENV === 'production') return 'https://www.golandly.com'
  if (env.VERCEL_URL) return `https://${env.VERCEL_URL}`
  throw new TranzilaConfigError('No public origin for the payment notification (set TRANZILA_NOTIFY_ORIGIN).')
}

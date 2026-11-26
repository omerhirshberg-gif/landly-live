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
//  TRANZILA_VERIFIER         how a charge is verified before settlement (R2). `failclosed` (the default, and the value when unset): nothing
//                            settles, every confirmation answers 503. `reports`: Tranzila's Reports API (lib/payments/reportsVerifier.ts);
//                            needs TRANZILA_ORDER_REF_FIELD. `response_hash`: the signed Hosted Fields charge response
//                            (lib/payments/responseHashVerifier.ts); needs TRANZILA_RESPONSE_HASH_SECRET. Switch only after Tranzila has
//                            confirmed the reference binding / hash format for the approved merchant number.
//  TRANZILA_ORDER_REF_FIELD  `reports` only: the terminal's additional transaction field (its api_parameter_name) that carries our order id
//  TRANZILA_REPORTS_URL      optional override of the Reports API origin (https, tranzila.com host)
//  TRANZILA_APPLE_PAY / TRANZILA_GOOGLE_PAY  `1` shows that wallet beside the card fields; set only once Tranzila has enabled the wallet
//                            on the terminal (support ticket #512658609). Unset, no wallet button is offered.
//  TRANZILA_APPLE_PAY_DOMAIN_ASSOCIATION  the content of Tranzila's apple-developer-merchantid-domain-association file, served at
//                            /.well-known/apple-developer-merchantid-domain-association (app/.well-known/...)
export const DEFAULT_HANDSHAKE_URL = 'https://api.tranzila.com/v2/handshake/create'
export const DEFAULT_REPORTS_URL = 'https://report.tranzila.com'

export type VerifierMode = 'failclosed' | 'reports' | 'response_hash'
const VERIFIER_MODES: readonly VerifierMode[] = ['failclosed', 'reports', 'response_hash']

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
  /** R2: how charges are verified. `failclosed` unless an operator opts in. */
  verifier: VerifierMode
  /** `reports` mode: the terminal field carrying our order id. */
  orderRefField: string | null
  /** Reports API origin (no trailing slash). */
  reportsUrl: string
  wallets: { applePay: boolean; googlePay: boolean }
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

// `tranzila.com` or a subdomain of it: never `eviltranzila.com`.
const isTranzilaHost = (hostname: string) => hostname === 'tranzila.com' || hostname.endsWith('.tranzila.com')

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
  if (!isTranzilaHost(handshake.hostname)) throw new TranzilaConfigError('TRANZILA_HANDSHAKE_URL must be a tranzila.com host.')
  const verifier = (env.TRANZILA_VERIFIER || 'failclosed') as VerifierMode
  if (!VERIFIER_MODES.includes(verifier)) throw new TranzilaConfigError(`TRANZILA_VERIFIER must be one of ${VERIFIER_MODES.join(', ')}.`)
  const orderRefField = env.TRANZILA_ORDER_REF_FIELD || null
  if (orderRefField !== null && !/^[A-Za-z0-9_]{1,64}$/.test(orderRefField)) throw new TranzilaConfigError('TRANZILA_ORDER_REF_FIELD is malformed.')
  if (verifier === 'reports' && !orderRefField) {
    throw new TranzilaConfigError('TRANZILA_VERIFIER=reports needs TRANZILA_ORDER_REF_FIELD: without a reference on the transaction an approved payment cannot be tied to its order.')
  }
  if (verifier === 'response_hash' && !env.TRANZILA_RESPONSE_HASH_SECRET) {
    throw new TranzilaConfigError('TRANZILA_VERIFIER=response_hash needs TRANZILA_RESPONSE_HASH_SECRET.')
  }
  const reports = httpsUrl(env.TRANZILA_REPORTS_URL || DEFAULT_REPORTS_URL, 'TRANZILA_REPORTS_URL')
  if (!isTranzilaHost(reports.hostname)) throw new TranzilaConfigError('TRANZILA_REPORTS_URL must be a tranzila.com host.')
  return {
    terminal,
    appKey: env.TRANZILA_API_APP_KEY!,
    apiSecret: env.TRANZILA_API_SECRET!,
    webhookSecret: env.TRANZILA_WEBHOOK_SECRET!,
    handshakeUrl,
    responseHashSecret: env.TRANZILA_RESPONSE_HASH_SECRET || null,
    verifier,
    orderRefField,
    reportsUrl: reports.origin,
    wallets: { applePay: env.TRANZILA_APPLE_PAY === '1', googlePay: env.TRANZILA_GOOGLE_PAY === '1' },
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

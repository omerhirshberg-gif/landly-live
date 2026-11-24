import 'server-only'
import { createSign } from 'node:crypto'
import { buildGenericClass, type GoogleWalletConfigReady } from './googlePass'

// Google Wallet's REST side (walletobjects.googleapis.com), called as the Firebase Admin
// service account with the wallet_object.issuer scope. The account must be an issuer user in
// the Google Pay & Wallet Console and the Wallet API must be enabled in its project.
// Errors carry the stage and HTTP status only, never a token, a payload or a credential.

const TOKEN_URL = 'https://oauth2.googleapis.com/token'
const API = 'https://walletobjects.googleapis.com/walletobjects/v1'
export const WALLET_SCOPE = 'https://www.googleapis.com/auth/wallet_object.issuer'
const TIMEOUT_MS = 10_000

export class GoogleWalletError extends Error {
  /**
   * Google's own error body (message, status, reasons), redacted and shortened: for the setup script and tests. The
   * routes log only `stage` and `status`, never this.
   */
  constructor(readonly stage: 'token' | 'class' | 'object', readonly status: number, readonly detail = '') {
    super(`Google Wallet ${stage} request failed (${status}).`)
  }
}

// Google's error bodies carry no credentials, but this is shown in a terminal, so anything shaped like one is cut anyway.
const SECRET_SHAPES = /(Bearer\s+\S+|ya29\.[\w.-]+|-----BEGIN[\s\S]*?(?:-----END[^-]*-----|$)|"(?:private_key|assertion|access_token|refresh_token)"\s*:\s*"[^"]*")/g

/** Reads a failed response into a GoogleWalletError, with Google's reason when the body has one. */
export async function walletFailure(stage: 'token' | 'class' | 'object', res: Response): Promise<GoogleWalletError> {
  const text = await res.text().catch(() => '')
  return new GoogleWalletError(stage, res.status, text.replace(SECRET_SHAPES, '[redacted]').trim().slice(0, 1500))
}

const b64 = (value: string) => Buffer.from(value).toString('base64url')
const tokens = new Map<string, { token: string; expiresAt: number }>()
const ensuredClasses = new Set<string>()

/** Test hook: forget the cached token and class checks. */
export function resetGoogleWalletCaches() {
  tokens.clear()
  ensuredClasses.clear()
}

export async function getWalletAccessToken(config: GoogleWalletConfigReady, nowMs = Date.now()): Promise<string> {
  const cached = tokens.get(config.serviceAccountEmail)
  if (cached && cached.expiresAt - 60_000 > nowMs) return cached.token
  const iat = Math.floor(nowMs / 1000)
  const unsigned = `${b64(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))}.${b64(JSON.stringify({ iss: config.serviceAccountEmail, scope: WALLET_SCOPE, aud: TOKEN_URL, iat, exp: iat + 3600 }))}`
  const assertion = `${unsigned}.${createSign('RSA-SHA256').update(unsigned).sign(config.privateKey).toString('base64url')}`
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  })
  if (!res.ok) throw await walletFailure('token', res)
  const data = (await res.json().catch(() => null)) as { access_token?: unknown; expires_in?: unknown } | null
  if (typeof data?.access_token !== 'string') throw new GoogleWalletError('token', res.status)
  tokens.set(config.serviceAccountEmail, { token: data.access_token, expiresAt: nowMs + (typeof data.expires_in === 'number' ? data.expires_in : 3600) * 1000 })
  return data.access_token
}

async function call(stage: 'class' | 'object', token: string, method: string, path: string, body?: unknown): Promise<Response> {
  return fetch(`${API}${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(TIMEOUT_MS),
  }).catch(() => {
    throw new GoogleWalletError(stage, 0)
  })
}

/**
 * Makes sure this environment's GenericClass exists: checked once per process, created when Google answers 404
 * (a 409 from a concurrent creator counts as done). The setup script (scripts/setupGoogleWalletClass.ts) does the
 * same ahead of time and can also update an existing class.
 */
export async function ensureGenericClass(config: GoogleWalletConfigReady, token: string): Promise<void> {
  if (ensuredClasses.has(config.classId)) return
  const found = await call('class', token, 'GET', `/genericClass/${encodeURIComponent(config.classId)}`)
  if (found.status === 404) {
    const created = await call('class', token, 'POST', '/genericClass', buildGenericClass(config))
    if (!created.ok && created.status !== 409) throw await walletFailure('class', created)
  } else if (!found.ok) {
    throw await walletFailure('class', found)
  }
  ensuredClasses.add(config.classId)
}

/** Insert, then patch when the object already exists (a member adding the same voucher again). */
export async function upsertGenericObject(token: string, object: { id: string }): Promise<void> {
  const inserted = await call('object', token, 'POST', '/genericObject', object)
  if (inserted.ok) return
  if (inserted.status !== 409) throw await walletFailure('object', inserted)
  const patched = await call('object', token, 'PATCH', `/genericObject/${encodeURIComponent(object.id)}`, object)
  if (!patched.ok) throw await walletFailure('object', patched)
}

/** Overwrites this environment's existing GenericClass with the current definition (the setup script's --update). */
export async function updateGenericClass(config: GoogleWalletConfigReady, token: string): Promise<void> {
  const res = await call('class', token, 'PATCH', `/genericClass/${encodeURIComponent(config.classId)}`, buildGenericClass(config))
  if (!res.ok) throw await walletFailure('class', res)
}

import {
  browserSupportsWebAuthn,
  browserSupportsWebAuthnAutofill,
  sendSignal,
  startAuthentication,
  startRegistration,
  WebAuthnAbortService,
} from '@simplewebauthn/browser'
import { setPersistence, type Persistence, type User } from 'firebase/auth'
import { auth } from '@/lib/firebase/config'
import { signInCustomerWithCustomToken, type CustomerSignInResult } from '@/lib/auth/signInCustomer'
import type { Lang } from '@/lib/i18n/translations'

// The website's side of passkeys (the app has its own Face ID / fingerprint
// lock instead, landly-mobile/src/auth/AppLock.tsx). Sign-in: options from
// /api/auth/passkey/login-options, the browser's passkey sheet (or the email
// field's autofill), then login-verify answers with a custom token for the
// shared customer sign-in. Settings: add, list and remove through the
// /api/auth/passkey/register-* and /api/account/passkeys routes.

export type PasskeyErrorCode =
  | 'unknown_credential'
  | 'unverified'
  | 'account_disabled'
  | 'already_registered'
  | 'rate_limited'
  | 'unavailable'
  | 'failed'

export type PasskeySignInOutcome =
  | { kind: 'signedIn'; result: CustomerSignInResult }
  /** Dismissed, timed out, or superseded (the autofill request when the button is pressed). Nothing to report. */
  | { kind: 'cancelled' }
  /** The autofill request outlived its challenge; start a new one quietly. */
  | { kind: 'expired' }
  | { kind: 'error'; code: PasskeyErrorCode }

// This browser has created or used a Landly passkey, so the sign-in screen
// leads with the passkey button. A hint only: the passkey itself lives in the
// member's password manager, and clearing site data just demotes the button.
const HINT_KEY = 'landly.passkeyHint'

export function hasPasskeyHint(): boolean {
  try {
    return window.localStorage.getItem(HINT_KEY) === '1'
  } catch {
    return false
  }
}

function setPasskeyHint(on: boolean) {
  try {
    if (on) window.localStorage.setItem(HINT_KEY, '1')
    else window.localStorage.removeItem(HINT_KEY)
  } catch {
    // Storage blocked (private mode): the button just isn't promoted.
  }
}

export interface PasskeySupport {
  /** The passkey button and the Settings card. */
  webauthn: boolean
  /** Passkeys offered in the email field's autofill (conditional mediation). */
  autofill: boolean
}

export async function passkeySupport(): Promise<PasskeySupport> {
  if (typeof window === 'undefined' || !browserSupportsWebAuthn()) return { webauthn: false, autofill: false }
  return { webauthn: true, autofill: await browserSupportsWebAuthnAutofill().catch(() => false) }
}

/** Ends a pending passkey request (the autofill one) without an error to report. */
export function cancelPasskeyRequest() {
  WebAuthnAbortService.cancelCeremony()
}

// NotAllowedError covers the member closing the sheet and the browser's
// timeout alike; AbortError is our own cancel. Both are silent.
function isCancellation(err: unknown): boolean {
  const e = err as { name?: string; code?: string; cause?: { name?: string } } | null
  if (e?.code === 'ERROR_CEREMONY_ABORTED') return true
  const name = e?.cause?.name ?? e?.name
  return name === 'NotAllowedError' || name === 'AbortError'
}

function isPreviouslyRegistered(err: unknown): boolean {
  const e = err as { name?: string; code?: string; cause?: { name?: string } } | null
  return e?.code === 'ERROR_AUTHENTICATOR_PREVIOUSLY_REGISTERED' || (e?.cause?.name ?? e?.name) === 'InvalidStateError'
}

function errorCode(status: number, error: unknown): PasskeyErrorCode {
  if (status === 429) return 'rate_limited'
  if (error === 'passkeys_unavailable') return 'unavailable'
  if (error === 'unknown_credential' || error === 'unverified' || error === 'account_disabled' || error === 'already_registered') return error
  return 'failed'
}

async function postJson(path: string, body: unknown, idToken?: string): Promise<{ status: number; data: Record<string, unknown> }> {
  const res = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}) },
    body: JSON.stringify(body ?? {}),
  })
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>
  return { status: res.status, data }
}

/**
 * Signs in with a passkey: from the button (`autofill: false`, the browser's
 * passkey sheet) or armed on the email field (`autofill: true`, the passkey
 * shows up among the field's suggestions and the promise waits until one is
 * picked or the request is cancelled). `persistence` follows Remember me.
 */
export async function signInWithPasskey({
  autofill,
  lang,
  persistence,
}: {
  autofill: boolean
  lang: Lang
  persistence: () => Persistence
}): Promise<PasskeySignInOutcome> {
  let options
  try {
    options = await postJson('/api/auth/passkey/login-options', {})
  } catch {
    return { kind: 'error', code: 'failed' }
  }
  if (options.status !== 200) return { kind: 'error', code: errorCode(options.status, options.data.error) }
  const { challengeId, optionsJSON } = options.data as { challengeId: string; optionsJSON: Parameters<typeof startAuthentication>[0]['optionsJSON'] }

  let response
  try {
    response = await startAuthentication({ optionsJSON, useBrowserAutofill: autofill })
  } catch (err) {
    if (isCancellation(err)) return { kind: 'cancelled' }
    return { kind: 'error', code: 'failed' }
  }

  let verified
  try {
    verified = await postJson('/api/auth/passkey/login-verify', { challengeId, response })
  } catch {
    return { kind: 'error', code: 'failed' }
  }
  if (verified.status !== 200) {
    const { error, rpId } = verified.data
    if (error === 'challenge_expired') return autofill ? { kind: 'expired' } : { kind: 'error', code: 'failed' }
    if (error === 'business_account') return { kind: 'signedIn', result: { status: 'businessAccount' } }
    if (error === 'unknown_credential') {
      setPasskeyHint(false)
      // Lets the password manager hide or delete the passkey this server no longer accepts.
      if (typeof rpId === 'string') sendSignal({ signalName: 'unknownCredential', rpID: rpId, credentialID: response.id }).catch(() => {})
    }
    return { kind: 'error', code: errorCode(verified.status, error) }
  }

  await setPersistence(auth, persistence())
  const result = await signInCustomerWithCustomToken(String(verified.data.customToken), lang)
  if (result.status === 'signedIn') setPasskeyHint(true)
  return { kind: 'signedIn', result }
}

export interface PasskeySummary {
  id: string
  name: string
  createdAt: string | null
  lastUsedAt: string | null
  synced: boolean
}

export type AddPasskeyOutcome =
  | { kind: 'added'; passkey: PasskeySummary }
  | { kind: 'cancelled' }
  /** The sign-in is older than 10 minutes: confirm the password (or Google) and try again. */
  | { kind: 'reauth' }
  | { kind: 'error'; code: PasskeyErrorCode }

export async function addPasskey(user: User): Promise<AddPasskeyOutcome> {
  let options
  try {
    options = await postJson('/api/auth/passkey/register-options', {}, await user.getIdToken())
  } catch {
    return { kind: 'error', code: 'failed' }
  }
  if (options.status === 403 && options.data.error === 'reauth_required') return { kind: 'reauth' }
  if (options.status !== 200) return { kind: 'error', code: errorCode(options.status, options.data.error) }
  const { challengeId, optionsJSON } = options.data as { challengeId: string; optionsJSON: Parameters<typeof startRegistration>[0]['optionsJSON'] }

  let response
  try {
    response = await startRegistration({ optionsJSON })
  } catch (err) {
    if (isPreviouslyRegistered(err)) return { kind: 'error', code: 'already_registered' }
    if (isCancellation(err)) return { kind: 'cancelled' }
    return { kind: 'error', code: 'failed' }
  }

  let verified
  try {
    verified = await postJson('/api/auth/passkey/register-verify', { challengeId, response }, await user.getIdToken())
  } catch {
    return { kind: 'error', code: 'failed' }
  }
  if (verified.status === 403 && verified.data.error === 'reauth_required') return { kind: 'reauth' }
  if (verified.status !== 200) return { kind: 'error', code: errorCode(verified.status, verified.data.error) }
  setPasskeyHint(true)
  return { kind: 'added', passkey: verified.data.passkey as PasskeySummary }
}

/** The member's passkeys; null when this deployment has passkeys switched off. */
export async function fetchPasskeys(user: User): Promise<PasskeySummary[] | null> {
  const res = await fetch('/api/account/passkeys', { headers: { Authorization: `Bearer ${await user.getIdToken()}` } })
  if (!res.ok) throw new Error(`passkeys ${res.status}`)
  const data = (await res.json()) as { available: boolean; passkeys: PasskeySummary[] }
  return data.available ? data.passkeys : null
}

export async function removePasskey(user: User, id: string): Promise<boolean> {
  const res = await fetch(`/api/account/passkeys/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${await user.getIdToken()}` },
  })
  return res.ok
}

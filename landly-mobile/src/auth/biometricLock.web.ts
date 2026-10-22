// Browser build (Metro picks this over biometricLock.ts for web): no biometrics or
// Keychain in a browser, so the app lock never shows. The website offers
// passkeys instead (lib/auth/passkeyClient.ts).
import type { BiometricKind, BiometricStatus, UnlockError } from './biometricLock'

export type { BiometricKind, BiometricStatus, UnlockError }

export const APP_LOCK_SUPPORTED = false

export function biometricKind(): BiometricKind {
  return 'biometrics'
}

export async function biometricStatus(): Promise<BiometricStatus> {
  return { hardware: false, enrolled: false, kind: 'biometrics' }
}

export async function authenticate(): Promise<{ success: true } | { success: false; error: UnlockError }> {
  return { success: false, error: 'not_available' }
}

export async function isAppLockEnabled(): Promise<boolean> {
  return false
}

export async function setAppLockEnabled(): Promise<void> {}

export async function wasAppLockOffered(): Promise<boolean> {
  return true
}

export async function markAppLockOffered(): Promise<void> {}

export async function getLastEntry(): Promise<string | null> {
  return null
}

export async function recordLastEntry(): Promise<void> {}

import { Platform } from 'react-native'
import * as LocalAuthentication from 'expo-local-authentication'
import * as SecureStore from 'expo-secure-store'
import type { AppLockSetting } from '@shared/auth/appLockPolicy'

// The app lock's device side (iOS/Android; biometricLock.web.ts for the Expo web
// build). The lock sits in front of the Firebase session already saved on the
// device: nothing secret is stored, only a per-account "on" flag in the
// Keychain / Keystore, so turning it on never touches the password or the
// session. The lock is on by default; the flag records the member's own
// choice ('1' on, '0' off), per uid: it survives signing out, so the same
// member signing in again on this device keeps their choice, while another
// account on the phone never inherits it. "Sign out of all devices" turns it off.
export const APP_LOCK_SUPPORTED = true

export type BiometricKind = 'faceId' | 'touchId' | 'fingerprint' | 'face' | 'iris' | 'biometrics'

export interface BiometricStatus {
  hardware: boolean
  enrolled: boolean
  kind: BiometricKind
}

export type UnlockError = LocalAuthentication.LocalAuthenticationError

const { AuthenticationType } = LocalAuthentication
const flagKey = (uid: string) => `landly.applock.${uid}`
const lastEntryKey = (uid: string) => `landly.applock.lastEntry.${uid}`
const STORE_OPTIONS: SecureStore.SecureStoreOptions = { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY }

// iOS has one kind per device; Android may have several, named generically then.
export function biometricKind(types: LocalAuthentication.AuthenticationType[], os = Platform.OS): BiometricKind {
  const face = types.includes(AuthenticationType.FACIAL_RECOGNITION)
  const finger = types.includes(AuthenticationType.FINGERPRINT)
  const iris = types.includes(AuthenticationType.IRIS)
  if (os === 'ios') return face ? 'faceId' : finger ? 'touchId' : 'biometrics'
  if ([face, finger, iris].filter(Boolean).length > 1) return 'biometrics'
  if (finger) return 'fingerprint'
  if (face) return 'face'
  if (iris) return 'iris'
  return 'biometrics'
}

export async function biometricStatus(): Promise<BiometricStatus> {
  try {
    const [hardware, enrolled, types] = await Promise.all([
      LocalAuthentication.hasHardwareAsync(),
      LocalAuthentication.isEnrolledAsync(),
      LocalAuthentication.supportedAuthenticationTypesAsync(),
    ])
    return { hardware, enrolled, kind: biometricKind(types) }
  } catch {
    return { hardware: false, enrolled: false, kind: 'biometrics' }
  }
}

/**
 * The system prompt. The device passcode stays available as a fallback
 * (iOS after a failed Face ID / Touch ID, Android as "Use PIN"), so a member
 * whose face or finger isn't recognised is never stuck behind the lock.
 */
export async function authenticate(prompt: {
  promptMessage: string
  cancelLabel: string
  fallbackLabel: string
}): Promise<{ success: true } | { success: false; error: UnlockError }> {
  try {
    const result = await LocalAuthentication.authenticateAsync({ ...prompt, disableDeviceFallback: false })
    return result.success ? { success: true } : { success: false, error: result.error }
  } catch {
    return { success: false, error: 'unknown' }
  }
}

/** The member's choice on this device; null until they make one (the lock is on by default). */
export async function getAppLockSetting(uid: string): Promise<AppLockSetting> {
  try {
    const value = await SecureStore.getItemAsync(flagKey(uid), STORE_OPTIONS)
    return value === '1' ? 'on' : value === '0' ? 'off' : null
  } catch {
    return null
  }
}

export async function setAppLockEnabled(uid: string, on: boolean): Promise<void> {
  await SecureStore.setItemAsync(flagKey(uid), on ? '1' : '0', STORE_OPTIONS)
}

/**
 * The member's last entry on this device (an unlock, a sign-in here, or
 * opening the app unlocked), as an ISO timestamp: the 30-day idle clock
 * (SESSION_MAX_IDLE_MS). In the Keychain / Keystore like the flag,
 * device-only, so a phone restored from a backup never carries another
 * device's time.
 */
export async function getLastEntry(uid: string): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(lastEntryKey(uid), STORE_OPTIONS)
  } catch {
    return null
  }
}

export async function recordLastEntry(uid: string, at = new Date()): Promise<void> {
  await SecureStore.setItemAsync(lastEntryKey(uid), at.toISOString(), STORE_OPTIONS).catch(() => {})
}

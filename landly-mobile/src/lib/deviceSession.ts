import { useEffect } from 'react'
import { AppState, Platform } from 'react-native'
import * as Crypto from 'expo-crypto'
import * as SecureStore from 'expo-secure-store'
import type { User } from 'firebase/auth'
import { nativeDeviceName, type NativeDeviceInfo } from '@shared/account/deviceName'
import { heartbeatDue, isSessionId, newSessionId } from '@shared/account/sessionList'
import { endSession, recordSession } from '@shared/account/sessions'

// This phone's row in Privacy & Security's Sessions list (web: the
// browser's own, components/settings/SessionHeartbeat.tsx). The id lives in
// the secure store, this device only (never restored onto a new phone from a
// backup), so it names one physical install; the name comes from
// expo-device ("iPhone 15 Pro", "Galaxy S24").

// expo-device is a native module: an app build from before it was added has
// no ExpoDevice, and importing it there would throw, so it's loaded lazily
// and the name falls back to what React Native knows (Android's maker and
// model, else the platform).
type DeviceModule = Required<{ [K in keyof NativeDeviceInfo]: string | null }>
let deviceModule: DeviceModule | null | undefined
function device(): DeviceModule | null {
  if (deviceModule === undefined) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      deviceModule = require('expo-device') as DeviceModule
    } catch {
      deviceModule = null
    }
  }
  return deviceModule
}

const ID_KEY = 'landly.session.id'
const STORE_OPTIONS: SecureStore.SecureStoreOptions = { keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY }
const platform: 'ios' | 'android' = Platform.OS === 'ios' ? 'ios' : 'android'

let idPromise: Promise<string> | null = null

/** This install's session id, created on first use. */
export function deviceSessionId(): Promise<string> {
  idPromise ??= (async () => {
    const stored = await SecureStore.getItemAsync(ID_KEY, STORE_OPTIONS).catch(() => null)
    if (isSessionId(stored)) return stored
    const id = newSessionId((n) => Crypto.getRandomBytes(n))
    await SecureStore.setItemAsync(ID_KEY, id, STORE_OPTIONS).catch(() => {})
    return id
  })()
  return idPromise
}

export function deviceSessionName(): string {
  const info = device()
  const constants = Platform.constants as { Model?: string; Manufacturer?: string }
  return nativeDeviceName(info ?? { modelName: constants.Model ?? null, manufacturer: constants.Manufacturer ?? null }, platform)
}

let lastWrite: { uid: string; at: number } | null = null

async function beat(uid: string) {
  const now = Date.now()
  if (!heartbeatDue(lastWrite?.uid === uid ? lastWrite.at : null, now)) return
  lastWrite = { uid, at: now }
  const ok = await recordSession(uid, await deviceSessionId(), { deviceName: deviceSessionName(), platform })
  // A failed write (offline, not yet verified) is tried again on the next launch or foreground.
  if (!ok && lastWrite?.uid === uid) lastWrite = null
}

/** Keeps this device's row fresh while a verified member is signed in: now, and on each return to the foreground. */
export function useDeviceSession(user: User | null) {
  const uid = user && user.emailVerified ? user.uid : null
  useEffect(() => {
    if (!uid) return
    void beat(uid)
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') void beat(uid)
    })
    return () => sub.remove()
  }, [uid])
}

/** After "Sign out of all devices" the server cleared every row; this device writes its own again when it next signs in. */
export function forgetSessionWrite() {
  lastWrite = null
}

/** Signing out of this phone on purpose: its row leaves the member's other devices' lists first (while it still may). */
export async function endDeviceSession(uid: string) {
  lastWrite = null
  await endSession(uid, await deviceSessionId())
}

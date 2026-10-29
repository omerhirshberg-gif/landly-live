import { MAX_DEVICE_NAME } from './deviceName'

// The devices a member is signed in on, as Privacy & Security lists them
// (website and app). Each signed-in device keeps one document,
//
//   users/{uid}/sessions/{sessionId}
//
// where sessionId is a random id the device keeps for itself (the app's
// secure store, the browser's localStorage), so the same phone or browser
// overwrites its own document instead of adding one per launch. The device
// writes it on launch and when it comes back to the foreground, at most once
// per SESSION_HEARTBEAT_MS (lib/account/sessions.ts); "Sign out of all
// devices" deletes them all on the server. The pure half (parsing, ordering),
// so tests needn't touch Firebase.

export type SessionPlatform = 'ios' | 'android' | 'web'

export interface UserSession {
  id: string
  deviceName: string
  platform: SessionPlatform
  lastActiveAt: Date | null
  createdAt: Date | null
  /** This is the device reading the list. */
  current: boolean
}

/** A device writes its session at most this often. */
export const SESSION_HEARTBEAT_MS = 15 * 60 * 1000
/** A device unseen for this long is no longer listed (it signed out, was wiped, or the app was removed). */
export const SESSION_STALE_MS = 30 * 24 * 60 * 60 * 1000

const SESSION_ID = /^[A-Za-z0-9_-]{16,64}$/

export function isSessionId(value: unknown): value is string {
  return typeof value === 'string' && SESSION_ID.test(value)
}

/** A fresh id: 32 hex characters from 16 random bytes (Web Crypto, or expo-crypto's on native). */
export function newSessionId(randomBytes: (n: number) => Uint8Array): string {
  return [...randomBytes(16)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

const toDate = (value: unknown): Date | null => {
  if (value instanceof Date) return value
  if (value && typeof (value as { toDate?: unknown }).toDate === 'function') return (value as { toDate: () => Date }).toDate()
  return null
}

export function parseSession(id: string, data: Record<string, unknown>, currentId: string | null): UserSession | null {
  const platform = data.platform
  if (platform !== 'ios' && platform !== 'android' && platform !== 'web') return null
  const deviceName = typeof data.deviceName === 'string' ? data.deviceName.trim().slice(0, MAX_DEVICE_NAME) : ''
  return {
    id,
    deviceName,
    platform,
    lastActiveAt: toDate(data.lastActiveAt),
    createdAt: toDate(data.createdAt),
    current: id === currentId,
  }
}

/**
 * This device first (even before its first write lands), then the others,
 * most recently active first, without the ones unseen for SESSION_STALE_MS.
 */
export function orderSessions(sessions: readonly UserSession[], now: number): UserSession[] {
  const others = sessions
    .filter((s) => !s.current && s.lastActiveAt && now - s.lastActiveAt.getTime() < SESSION_STALE_MS)
    .sort((a, b) => b.lastActiveAt!.getTime() - a.lastActiveAt!.getTime())
  const current = sessions.filter((s) => s.current)
  return [...current, ...others]
}

/** Whether this device's session is due another write. */
export function heartbeatDue(lastWrittenAt: number | null, now: number): boolean {
  return lastWrittenAt === null || now - lastWrittenAt >= SESSION_HEARTBEAT_MS
}

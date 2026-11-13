// The app lock's launch rules (landly-mobile/src/auth/AppLock.tsx). Pure and
// dependency-free, so tests can pin the boundaries.

/** A saved session unused for longer than this ends at launch: the login form, with the email filled in. */
export const SESSION_MAX_IDLE_MS = 30 * 24 * 60 * 60 * 1000

/**
 * The member's choice on this device: 'on' or 'off' once made in Privacy &
 * Security, null until then (the lock is on by default).
 */
export type AppLockSetting = 'on' | 'off' | null

/**
 * Whether the lock guards this member's session. Never chosen, it's on
 * wherever the device has biometrics set up, so a device without them never
 * traps anyone behind a prompt it can't show.
 */
export function appLockOn(setting: AppLockSetting, device: { hardware: boolean; enrolled: boolean }): boolean {
  if (setting !== null) return setting === 'on'
  return device.hardware && device.enrolled
}

/**
 * Whether the last entry on this device (an unlock, a sign-in, or opening
 * the app unlocked) is more than SESSION_MAX_IDLE_MS ago. A missing or
 * unreadable entry isn't expired: sessions from before it was recorded
 * start their clock now instead of being signed out.
 */
export function entryExpired(lastEntry: string | null | undefined, now: number): boolean {
  if (!lastEntry) return false
  const at = new Date(lastEntry).getTime()
  if (Number.isNaN(at)) return false
  return now - at > SESSION_MAX_IDLE_MS
}

/** How long the app can stay in the background before coming back asks again. */
export type AppLockDelay = 'immediately' | '1m' | '5m'

export const APP_LOCK_DELAYS: readonly AppLockDelay[] = ['immediately', '1m', '5m']

/** Nothing chosen (or an unreadable value): the delay the app has always had. */
export const DEFAULT_APP_LOCK_DELAY: AppLockDelay = '1m'

export const APP_LOCK_DELAY_MS: Record<AppLockDelay, number> = {
  immediately: 0,
  '1m': 60_000,
  '5m': 300_000,
}

export function parseAppLockDelay(value: string | null | undefined): AppLockDelay {
  return APP_LOCK_DELAYS.includes(value as AppLockDelay) ? (value as AppLockDelay) : DEFAULT_APP_LOCK_DELAY
}

/** Whether being away for `awayMs` locks the app again: "immediately" on any return, otherwise only past the delay. */
export function shouldRelock(awayMs: number, delay: AppLockDelay): boolean {
  return delay === 'immediately' ? awayMs >= 0 : awayMs > APP_LOCK_DELAY_MS[delay]
}

/** Whether choosing `next` over `current` leaves the lock weaker (so it asks for a biometric check first). */
export function isLongerDelay(current: AppLockDelay, next: AppLockDelay): boolean {
  return APP_LOCK_DELAY_MS[next] > APP_LOCK_DELAY_MS[current]
}

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

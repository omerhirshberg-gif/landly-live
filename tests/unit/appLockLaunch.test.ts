import { readFile } from 'node:fs/promises'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { appLockOn, entryExpired, SESSION_MAX_IDLE_MS } from '@/lib/auth/appLockPolicy'

// biometricLock.ts reads the device through Expo (resolved from the app's own
// node_modules); the store is an in-memory Keychain here.
const store = vi.hoisted(() => new Map<string, string>())
vi.mock('../../landly-mobile/node_modules/react-native', () => ({ Platform: { OS: 'ios' } }))
vi.mock('../../landly-mobile/node_modules/expo-local-authentication', () => ({ AuthenticationType: {} }))
vi.mock('../../landly-mobile/node_modules/expo-secure-store', () => ({
  WHEN_UNLOCKED_THIS_DEVICE_ONLY: 0,
  getItemAsync: async (key: string) => store.get(key) ?? null,
  setItemAsync: async (key: string, value: string) => void store.set(key, value),
}))

type Storage = {
  getAppLockSetting: (uid: string) => Promise<'on' | 'off' | null>
  setAppLockEnabled: (uid: string, on: boolean) => Promise<void>
}
// A runtime-only path: a typed import would pull React Native's globals into the root typecheck.
const loadStorage = (file: string) => import(`../../landly-mobile/src/auth/${file}`) as Promise<Storage>

const DAY = 24 * 60 * 60 * 1000
const now = new Date('2026-10-23T12:00:00.000Z').getTime()
const ago = (ms: number) => new Date(now - ms).toISOString()

describe('30-day idle expiry', () => {
  it('is 30 days', () => {
    expect(SESSION_MAX_IDLE_MS).toBe(30 * DAY)
  })

  it('expires only past 30 days without an entry', () => {
    expect(entryExpired(ago(29 * DAY + 23 * 60 * 60 * 1000), now)).toBe(false)
    expect(entryExpired(ago(30 * DAY), now)).toBe(false)
    expect(entryExpired(ago(30 * DAY + 60_000), now)).toBe(true)
    expect(entryExpired(ago(400 * DAY), now)).toBe(true)
  })

  it('never expires a session with no readable entry, or one from the future', () => {
    expect(entryExpired(null, now)).toBe(false)
    expect(entryExpired(undefined, now)).toBe(false)
    expect(entryExpired('not a date', now)).toBe(false)
    expect(entryExpired(ago(-DAY), now)).toBe(false)
  })
})

describe('lock setting', () => {
  const ready = { hardware: true, enrolled: true }

  it('is on by default wherever biometrics are set up', () => {
    expect(appLockOn(null, ready)).toBe(true)
    expect(appLockOn(null, { hardware: true, enrolled: false })).toBe(false)
    expect(appLockOn(null, { hardware: false, enrolled: false })).toBe(false)
  })

  it("follows the member's own choice once made", () => {
    expect(appLockOn('off', ready)).toBe(false)
    expect(appLockOn('on', ready)).toBe(true)
  })

  describe('on the device', () => {
    beforeEach(() => store.clear())

    it('reads an unset flag as no choice, and stores off as a choice rather than deleting it', async () => {
      const { getAppLockSetting, setAppLockEnabled } = await loadStorage('biometricLock')
      expect(await getAppLockSetting('u1')).toBeNull()
      await setAppLockEnabled('u1', false)
      expect(store.get('landly.applock.u1')).toBe('0')
      expect(await getAppLockSetting('u1')).toBe('off')
      await setAppLockEnabled('u1', true)
      expect(await getAppLockSetting('u1')).toBe('on')
      expect(await getAppLockSetting('u2')).toBeNull()
    })

    it('is inert in the browser build', async () => {
      const web = await loadStorage('biometricLock.web')
      const src = await readFile('landly-mobile/src/auth/biometricLock.web.ts', 'utf8')
      expect(src).toContain('export const APP_LOCK_SUPPORTED = false')
      expect(await web.getAppLockSetting('u1')).toBe('off')
    })
  })
})

describe('launch wiring', () => {
  it('ends an idle launch session before the tabs, with the email filled in', async () => {
    const lock = await readFile('landly-mobile/src/auth/AppLock.tsx', 'utf8')
    const launch = lock.slice(lock.indexOf('Promise.all([getAppLockSetting(uid), biometricStatus(), getLastEntry(uid)])'))
    expect(launch.length).toBeLessThan(lock.length)
    const expiry = launch.indexOf('if (launchSession && entryExpired(lastEntry, Date.now())) {')
    expect(expiry).toBeGreaterThan(-1)
    // The sign-out comes before `enabledFor` is set for this uid, so `known` stays false until it lands.
    expect(launch.slice(expiry)).toMatch(/^[^]*?setPrefillEmail\(auth\.currentUser\?\.email \?\? null\)\s*signOut\(auth\)\.catch\(proceed\)\s*return/)
    expect(launch.slice(expiry)).toMatch(/^[^]*?return\s*}\s*proceed\(\)/)
    expect(lock).toContain("const known = !loading && (!uid || !APP_LOCK_SUPPORTED || enabledFor?.uid === uid)")
  })

  it('restarts the clock when the app opens unlocked, not while the lock screen is up', async () => {
    const lock = await readFile('landly-mobile/src/auth/AppLock.tsx', 'utf8')
    expect(lock).toContain('if (!launchSession || !on || !lastEntry) recordLastEntry(uid)')
    expect(lock).toContain('} else if (uidRef.current && !lockedRef.current) {')
  })

  it('turns the lock off for "Sign out of all devices", and no longer offers it after a sign-in', async () => {
    const lock = await readFile('landly-mobile/src/auth/AppLock.tsx', 'utf8')
    const layout = await readFile('landly-mobile/src/app/_layout.tsx', 'utf8')
    expect(lock).toContain('await setAppLockEnabled(uid, false).catch(() => {})')
    expect(lock).not.toContain('offerAfterSignIn')
    expect(layout).not.toContain('offerAfterSignIn')
  })
})

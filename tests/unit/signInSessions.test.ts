import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { signInProvider, signInProviderCopy } from '@/lib/auth/signInProvider'
import { describeUserAgent, nativeDeviceName } from '@/lib/account/deviceName'
import { SESSION_HEARTBEAT_MS, SESSION_STALE_MS, heartbeatDue, isSessionId, newSessionId, orderSessions, parseSession, type UserSession } from '@/lib/account/sessionList'
import { translations } from '@/lib/i18n/translations'

const root = join(__dirname, '..', '..')
const read = (path: string) => readFileSync(join(root, path), 'utf8')
const providers = (...ids: string[]) => ids.map((providerId) => ({ providerId }))

describe('sign-in provider', () => {
  it('names Apple from apple.com, never as Google', () => {
    expect(signInProvider({ email: 'dana@icloud.com', providerData: providers('apple.com') })).toBe('apple')
    expect(signInProviderCopy('apple')).toEqual({ title: 'security_method_apple', note: 'security_apple_note' })
    expect(translations.en.security_apple_note).toContain('Apple ID')
    expect(translations.en.security_apple_note).not.toContain('Google')
  })

  it('recognises an Apple private-relay address even when the provider list is empty', () => {
    expect(signInProvider({ email: 'dvysx9vctw@PrivateRelay.AppleID.com', providerData: [] })).toBe('apple')
    expect(signInProvider({ email: 'x@privaterelay.appleid.com', providerData: null })).toBe('apple')
  })

  it('names Google from google.com, and a password account as Email & password', () => {
    expect(signInProvider({ email: 'a@gmail.com', providerData: providers('google.com') })).toBe('google')
    expect(signInProviderCopy('google').note).toBe('security_google_note')
    // A password wins: it's the one thing the card can change.
    expect(signInProvider({ email: 'a@gmail.com', providerData: providers('google.com', 'password') })).toBe('password')
    expect(signInProviderCopy('password')).toEqual({ title: 'security_method_password', note: null })
  })

  it('never guesses Google for an unknown provider', () => {
    expect(signInProvider({ email: 'a@x.com', providerData: [] })).toBe('other')
    expect(signInProviderCopy('other').title).toBe('security_method_other')
  })

  it('has every new string in every language', () => {
    for (const lang of Object.keys(translations) as (keyof typeof translations)[]) {
      for (const key of ['security_method_apple', 'security_apple_note', 'security_method_other', 'security_other_note', 'security_this_device_named', 'security_last_active'] as const) {
        expect(translations[lang][key], `${lang}.${key}`).toBeTruthy()
      }
      expect(translations[lang].security_this_device_named).toContain('{device}')
      expect(translations[lang].security_last_active).toContain('{time}')
    }
    expect(translations.he.security_apple_note).toContain('Apple')
  })

  it('reads the provider the same way on the website and in the app', () => {
    expect(read('app/settings/privacy-security/page.tsx')).toContain('signInProvider(user)')
    expect(read('landly-mobile/src/app/settings/privacy-security.tsx')).toContain('signInProvider(user)')
    for (const path of ['app/settings/privacy-security/page.tsx', 'landly-mobile/src/app/settings/privacy-security.tsx']) {
      expect(read(path), path).not.toContain("t('security_method_google')")
    }
  })
})

describe('device names', () => {
  it('names a phone by its model, an Android by the name its owner sees', () => {
    expect(nativeDeviceName({ modelName: 'iPhone 15 Pro', osName: 'iOS' }, 'ios')).toBe('iPhone 15 Pro')
    expect(nativeDeviceName({ modelName: 'iPad Air (5th generation)', osName: 'iPadOS' }, 'ios')).toBe('iPad Air (5th generation)')
    expect(nativeDeviceName({ modelName: 'SM-S921B', deviceName: 'Galaxy S24', manufacturer: 'samsung' }, 'android')).toBe('Galaxy S24')
    expect(nativeDeviceName({ modelName: 'SM-S921B', manufacturer: 'samsung' }, 'android')).toBe('Samsung SM-S921B')
    expect(nativeDeviceName({ modelName: 'Pixel 8', manufacturer: 'Google' }, 'android')).toBe('Google Pixel 8')
    expect(nativeDeviceName({ modelName: 'Pixel 8 Pro', manufacturer: 'pixel' }, 'android')).toBe('Pixel 8 Pro')
    // Never an Android build fingerprint.
    expect(nativeDeviceName({ osName: 'POCO/vayu_eea/vayu:11/RKQ1' }, 'android')).toBe('Android')
    expect(nativeDeviceName({}, 'ios')).toBe('iPhone')
  })

  it('names a browser by device and browser', () => {
    const ua = {
      macChrome: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
      winEdge: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 Edg/130.0.0.0',
      iphoneSafari: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
      iphoneChrome: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/130.0 Mobile/15E148 Safari/604.1',
      androidChrome: 'Mozilla/5.0 (Linux; Android 14; SM-S921B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36',
      samsung: 'Mozilla/5.0 (Linux; Android 14; SM-S921B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/26.0 Chrome/122.0.0.0 Mobile Safari/537.36',
      linuxFirefox: 'Mozilla/5.0 (X11; Linux x86_64; rv:131.0) Gecko/20100101 Firefox/131.0',
      macSafari: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15',
    }
    expect(describeUserAgent(ua.macChrome)).toBe('Mac · Chrome')
    expect(describeUserAgent(ua.winEdge)).toBe('Windows PC · Edge')
    expect(describeUserAgent(ua.iphoneSafari)).toBe('iPhone · Safari')
    expect(describeUserAgent(ua.iphoneChrome)).toBe('iPhone · Chrome')
    expect(describeUserAgent(ua.androidChrome)).toBe('Android phone · Chrome')
    expect(describeUserAgent(ua.samsung)).toBe('Android phone · Samsung Internet')
    expect(describeUserAgent(ua.linuxFirefox)).toBe('Linux · Firefox')
    expect(describeUserAgent(ua.macSafari)).toBe('Mac · Safari')
    // iPadOS asks for the desktop site with a Mac user agent; its touch screen gives it away.
    expect(describeUserAgent(ua.macSafari, 5)).toBe('iPad · Safari')
  })
})

describe('session list', () => {
  const now = Date.parse('2026-10-30T12:00:00Z')
  const session = (id: string, minutesAgo: number | null, current = false): UserSession => ({
    id, deviceName: id, platform: 'web', current, createdAt: null, lastActiveAt: minutesAgo === null ? null : new Date(now - minutesAgo * 60_000),
  })

  it('lists this device first, then the others by last activity, without the long-gone ones', () => {
    const ordered = orderSessions([session('old', 10), session('stale', SESSION_STALE_MS / 60_000 + 1), session('here', null, true), session('recent', 2), session('never', null)], now)
    expect(ordered.map((s) => s.id)).toEqual(['here', 'recent', 'old'])
  })

  it('parses a stored row, marking the current device, and drops a malformed one', () => {
    const at = new Date(now)
    const stamp = { toDate: () => at }
    expect(parseSession('abcdef0123456789', { deviceName: ' iPhone 15 Pro ', platform: 'ios', lastActiveAt: stamp, createdAt: stamp }, 'abcdef0123456789')).toEqual({
      id: 'abcdef0123456789', deviceName: 'iPhone 15 Pro', platform: 'ios', lastActiveAt: at, createdAt: at, current: true,
    })
    expect(parseSession('x', { deviceName: 'a', platform: 'windows' }, null)).toBeNull()
  })

  it('writes at most once per heartbeat interval', () => {
    expect(heartbeatDue(null, now)).toBe(true)
    expect(heartbeatDue(now - SESSION_HEARTBEAT_MS + 1, now)).toBe(false)
    expect(heartbeatDue(now - SESSION_HEARTBEAT_MS, now)).toBe(true)
  })

  it('makes random 32-character ids the rules accept', () => {
    const id = newSessionId((n) => new Uint8Array(n).fill(171))
    expect(id).toBe('ab'.repeat(16))
    expect(isSessionId(id)).toBe(true)
    expect(isSessionId('short')).toBe(false)
    expect(isSessionId('../users/x/sessions/y')).toBe(false)
  })
})

describe('where sessions are written', () => {
  it('lets a member write only their own device row, with server times', () => {
    const rules = read('firestore.rules')
    const block = rules.slice(rules.indexOf('match /users/{userId}/sessions/{sessionId}'), rules.indexOf('function validSession'))
    expect(block).toContain("request.auth.uid == userId && isVerified() && authFresh()")
    expect(block).toContain("hasOnly(['deviceName', 'platform', 'lastActiveAt', 'createdAt'])")
    expect(block).toContain("sessionId.matches('^[A-Za-z0-9_-]{16,64}$')")
    expect(block).toContain('request.resource.data.createdAt == resource.data.createdAt')
    expect(rules).toContain('data.lastActiveAt == request.time')
  })

  it('writes on launch and on returning to the foreground, in the app and on the website', () => {
    expect(read('landly-mobile/src/app/_layout.tsx')).toContain('useDeviceSession(signedIn ? user : null)')
    const mobile = read('landly-mobile/src/lib/deviceSession.ts')
    expect(mobile).toContain("AppState.addEventListener('change'")
    expect(mobile).toContain('SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY')
    expect(read('app/layout.tsx')).toContain('<SessionHeartbeat />')
    expect(read('components/settings/SessionHeartbeat.tsx')).toContain("addEventListener('visibilitychange'")
  })

  it('drops this device\'s row on a deliberate sign-out', () => {
    expect(read('components/layout/Navbar.tsx')).toContain('await endWebSession(auth.currentUser.uid)')
    expect(read('landly-mobile/src/app/(tabs)/profile.tsx')).toContain('await endDeviceSession(user.uid)')
  })
})

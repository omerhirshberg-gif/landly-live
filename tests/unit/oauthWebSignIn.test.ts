import { createRequire } from 'node:module'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  setPersistence: vi.fn(), popup: vi.fn(), redirect: vi.fn(), redirectResult: vi.fn(), finish: vi.fn(),
  auth: { name: 'auth', currentUser: null as unknown, authStateReady: vi.fn() },
}))
vi.mock('firebase/auth', () => ({
  setPersistence: mocks.setPersistence,
  signInWithPopup: mocks.popup,
  signInWithRedirect: mocks.redirect,
  getRedirectResult: mocks.redirectResult,
}))
const appleProvider = vi.hoisted(() => ({ providerId: 'apple.com', setCustomParameters: vi.fn() }))
vi.mock('@/lib/firebase/config', () => ({ auth: mocks.auth, googleProvider: { providerId: 'google.com' }, appleProvider }))
vi.mock('@/lib/auth/signInCustomer', () => ({ finishCustomerOAuthSignIn: mocks.finish }))

import {
  completeOAuthRedirect,
  pendingOAuthRedirect,
  isEmbeddedBrowser,
  REDIRECT_RESULT_TIMEOUT_MS,
  shouldFallBackToRedirect,
  startOAuthWebSignIn,
} from '@/lib/auth/oauthWebSignIn'
import { isAppleMobileWeb } from '@/lib/auth/appleDevice'
import { resolveAuthDomain } from '@/lib/firebase/authDomain'

const startGoogleWebSignIn = (lang: 'en' | 'he' | 'fr', p: never) => startOAuthWebSignIn('google', lang, p)
const completeGoogleRedirect = async (lang: 'en' | 'he' | 'fr') => (await completeOAuthRedirect(lang))?.result ?? null
const hasPendingGoogleRedirect = () => pendingOAuthRedirect() === 'google'
const mark = (provider: string, at = Date.now()) => store.set('landly_oauth_redirect', `${provider}:${at}`)
const firebaseError = (code: string) => Object.assign(new Error(code), { code })
const persistence = { type: 'LOCAL' } as never
const signedIn = { status: 'signedIn', user: { uid: 'u1' }, preferredLanguage: null }
const googleUser = { uid: 'u1', providerData: [{ providerId: 'google.com' }] }

// A Map-backed sessionStorage, the same whatever Node version runs the suite.
const store = new Map<string, string>()
vi.stubGlobal('sessionStorage', {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k),
})

beforeEach(() => {
  vi.clearAllMocks()
  vi.useRealTimers()
  store.clear()
  mocks.auth.currentUser = null
  mocks.auth.authStateReady.mockResolvedValue(undefined)
  mocks.setPersistence.mockResolvedValue(undefined)
  mocks.redirect.mockResolvedValue(undefined)
  mocks.finish.mockResolvedValue(signedIn)
})

describe('startGoogleWebSignIn', () => {
  it('uses the popup and the shared customer rules when it works', async () => {
    mocks.popup.mockResolvedValue({ user: { uid: 'u1' } })
    expect(await startGoogleWebSignIn('he', persistence)).toEqual({ kind: 'signedIn', result: signedIn })
    expect(mocks.setPersistence).toHaveBeenCalledWith(mocks.auth, persistence)
    expect(mocks.setPersistence.mock.invocationCallOrder[0]).toBeLessThan(mocks.popup.mock.invocationCallOrder[0])
    expect(mocks.finish).toHaveBeenCalledWith({ user: { uid: 'u1' } }, 'he', {})
    expect(mocks.redirect).not.toHaveBeenCalled()
  })

  it.each(['auth/popup-blocked', 'auth/operation-not-supported-in-this-environment'])('falls back to a redirect on %s', async (code) => {
    mocks.popup.mockRejectedValue(firebaseError(code))
    expect(await startGoogleWebSignIn('en', persistence)).toEqual({ kind: 'redirecting' })
    expect(mocks.redirect).toHaveBeenCalledWith(mocks.auth, { providerId: 'google.com' })
    expect(mocks.finish).not.toHaveBeenCalled()
  })

  it.each(['auth/popup-closed-by-user', 'auth/network-request-failed', 'auth/cancelled-popup-request'])('reports %s instead of redirecting', async (code) => {
    mocks.popup.mockRejectedValue(firebaseError(code))
    await expect(startGoogleWebSignIn('en', persistence)).rejects.toMatchObject({ code })
    expect(mocks.redirect).not.toHaveBeenCalled()
  })

  it('only treats coded errors as fallback candidates', () => {
    expect(shouldFallBackToRedirect(null)).toBe(false)
    expect(shouldFallBackToRedirect(new Error('auth/popup-blocked'))).toBe(false)
  })
})

describe('completeGoogleRedirect', () => {
  it('returns null on a normal page load', async () => {
    mocks.redirectResult.mockResolvedValue(null)
    expect(await completeGoogleRedirect('en')).toBeNull()
    expect(mocks.finish).not.toHaveBeenCalled()
  })

  it('runs the shared customer rules on the redirect credential', async () => {
    mocks.redirectResult.mockResolvedValue({ user: { uid: 'u1' } })
    expect(await completeGoogleRedirect('fr')).toBe(signedIn)
    expect(mocks.finish).toHaveBeenCalledWith({ user: { uid: 'u1' } }, 'fr', {})
  })

  it('marks the page before leaving for Google, and not on a popup sign-in', async () => {
    mocks.popup.mockRejectedValue(firebaseError('auth/popup-blocked'))
    mocks.redirect.mockImplementation(async () => {
      expect(hasPendingGoogleRedirect()).toBe(true)
    })
    await startGoogleWebSignIn('en', persistence)
    expect(mocks.redirect).toHaveBeenCalled()
    store.clear()
    mocks.popup.mockResolvedValue({ user: { uid: 'u1' } })
    await startGoogleWebSignIn('en', persistence)
    expect(hasPendingGoogleRedirect()).toBe(false)
  })

  it('drops the mark when the redirect cannot start', async () => {
    mocks.popup.mockRejectedValue(firebaseError('auth/popup-blocked'))
    mocks.redirect.mockRejectedValue(firebaseError('auth/network-request-failed'))
    await expect(startGoogleWebSignIn('en', persistence)).rejects.toMatchObject({ code: 'auth/network-request-failed' })
    expect(hasPendingGoogleRedirect()).toBe(false)
  })

  it('ignores a stale mark', () => {
    mark('google', Date.now() - 11 * 60 * 1000)
    expect(hasPendingGoogleRedirect()).toBe(false)
  })

  it('finishes with the restored Google session when the result was lost', async () => {
    mark('google')
    mocks.redirectResult.mockResolvedValue(null)
    mocks.auth.currentUser = googleUser
    expect(await completeGoogleRedirect('he')).toBe(signedIn)
    expect(mocks.finish).toHaveBeenCalledWith({ user: googleUser }, 'he', {})
    expect(hasPendingGoogleRedirect()).toBe(false)
  })

  it('recovers the session when the result fails on missing state', async () => {
    mark('google')
    mocks.redirectResult.mockRejectedValue(firebaseError('auth/missing-initial-state'))
    mocks.auth.currentUser = googleUser
    expect(await completeGoogleRedirect('en')).toBe(signedIn)
  })

  it('reports the failure when no session was restored', async () => {
    mark('google')
    mocks.redirectResult.mockRejectedValue(firebaseError('auth/missing-initial-state'))
    await expect(completeGoogleRedirect('en')).rejects.toMatchObject({ code: 'auth/missing-initial-state' })
    expect(hasPendingGoogleRedirect()).toBe(false)
  })

  it('never runs the Google rules on an email session', async () => {
    mark('google')
    mocks.redirectResult.mockResolvedValue(null)
    mocks.auth.currentUser = { uid: 'u2', providerData: [{ providerId: 'password' }] }
    expect(await completeGoogleRedirect('en')).toBeNull()
    expect(mocks.finish).not.toHaveBeenCalled()
  })

  it('stops waiting on a hung result: the session if there is one, else a timeout', async () => {
    vi.useFakeTimers()
    mocks.redirectResult.mockReturnValue(new Promise(() => undefined))
    mark('google')
    const failed = expect(completeGoogleRedirect('en')).rejects.toMatchObject({ code: 'auth/timeout' })
    await vi.advanceTimersByTimeAsync(REDIRECT_RESULT_TIMEOUT_MS)
    await failed

    mark('google')
    mocks.auth.currentUser = googleUser
    const recovered = completeGoogleRedirect('en')
    await vi.advanceTimersByTimeAsync(REDIRECT_RESULT_TIMEOUT_MS)
    expect(await recovered).toBe(signedIn)
  })

  it('treats a hung result on an ordinary load as no result', async () => {
    vi.useFakeTimers()
    mocks.redirectResult.mockReturnValue(new Promise(() => undefined))
    const result = completeGoogleRedirect('en')
    await vi.advanceTimersByTimeAsync(REDIRECT_RESULT_TIMEOUT_MS)
    expect(await result).toBeNull()
  })

  it('leaves no unhandled rejection when a result fails after the timeout', async () => {
    vi.useFakeTimers()
    let reject!: (err: unknown) => void
    mocks.redirectResult.mockReturnValue(new Promise((_, r) => (reject = r)))
    const result = completeGoogleRedirect('en')
    await vi.advanceTimersByTimeAsync(REDIRECT_RESULT_TIMEOUT_MS)
    expect(await result).toBeNull()
    reject(firebaseError('auth/internal-error'))
    await vi.advanceTimersByTimeAsync(0)
  })
})

describe('Apple on the web', () => {
  const appleUser = { uid: 'a1', providerData: [{ providerId: 'apple.com' }] }

  it('uses the Apple popup in the member\'s language and passes Apple\'s first-time name on', async () => {
    const cred = { user: { uid: 'a1' }, providerId: 'apple.com', _tokenResponse: { firstName: ' Noa ', lastName: 'Levi' } }
    mocks.popup.mockResolvedValue(cred)
    expect(await startOAuthWebSignIn('apple', 'he', persistence)).toEqual({ kind: 'signedIn', result: signedIn })
    expect(mocks.popup).toHaveBeenCalledWith(mocks.auth, appleProvider)
    expect(appleProvider.setCustomParameters).toHaveBeenCalledWith({ locale: 'he_IL' })
    expect(mocks.finish).toHaveBeenCalledWith(cred, 'he', { names: { firstName: 'Noa', lastName: 'Levi' } })
  })

  it('passes no name on a returning sign-in', async () => {
    const cred = { user: { uid: 'a1' }, providerId: 'apple.com', _tokenResponse: {} }
    mocks.popup.mockResolvedValue(cred)
    await startOAuthWebSignIn('apple', 'en', persistence)
    expect(mocks.finish).toHaveBeenCalledWith(cred, 'en', { names: null })
  })

  it('falls back to an Apple redirect and marks it as Apple\'s', async () => {
    mocks.popup.mockRejectedValue(firebaseError('auth/popup-blocked'))
    mocks.redirect.mockImplementation(async () => {
      expect(pendingOAuthRedirect()).toBe('apple')
    })
    expect(await startOAuthWebSignIn('apple', 'en', persistence)).toEqual({ kind: 'redirecting' })
    expect(mocks.redirect).toHaveBeenCalledWith(mocks.auth, appleProvider)
  })

  it('finishes an Apple redirect result as Apple, whatever the marker says', async () => {
    const cred = { user: { uid: 'a1' }, providerId: 'apple.com', _tokenResponse: { fullName: 'Dana Cohen' } }
    mocks.redirectResult.mockResolvedValue(cred)
    expect(await completeOAuthRedirect('en')).toEqual({ provider: 'apple', result: signedIn })
    expect(mocks.finish).toHaveBeenCalledWith(cred, 'en', { names: { firstName: 'Dana', lastName: 'Cohen' } })
  })

  it('recovers a lost Apple redirect only from an Apple session', async () => {
    mark('apple')
    mocks.redirectResult.mockResolvedValue(null)
    mocks.auth.currentUser = googleUser
    expect(await completeOAuthRedirect('en')).toBeNull()
    expect(mocks.finish).not.toHaveBeenCalled()

    mark('apple')
    mocks.auth.currentUser = appleUser
    expect(await completeOAuthRedirect('en')).toEqual({ provider: 'apple', result: signedIn })
    expect(mocks.finish).toHaveBeenCalledWith({ user: appleUser }, 'en', { names: null })
  })

  it('ignores a marker for an unknown provider', () => {
    mark('facebook')
    expect(pendingOAuthRedirect()).toBeNull()
  })
})

describe('isAppleMobileWeb', () => {
  it.each([
    ['iPhone Safari', 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1', 5, true],
    ['iPad (desktop-class UA)', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15', 5, true],
    ['Mac Safari', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15', 0, false],
    ['Android Chrome', 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36', 5, false],
    ['Windows Edge', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 Edg/130.0.0.0', 10, false],
  ] as const)('%s leads with Apple: %s', (_name, ua, touch, expected) => {
    expect(isAppleMobileWeb(ua, touch)).toBe(expected)
  })

  it('treats a missing user agent as not iOS', () => {
    expect(isAppleMobileWeb(undefined)).toBe(false)
  })
})

describe('isEmbeddedBrowser', () => {
  const UA = {
    iosSafari: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
    iosChrome: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/130.0.6723.90 Mobile/15E148 Safari/604.1',
    iosFirefox: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) FxiOS/132.0 Mobile/15E148 Safari/605.1.15',
    iosGoogleApp: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) GSA/340.0.687911373 Mobile/15E148 Safari/604.1',
    androidChrome: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36',
    samsung: 'Mozilla/5.0 (Linux; Android 14; SM-S921B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/26.0 Chrome/122.0.0.0 Mobile Safari/537.36',
    androidGoogleApp: 'Mozilla/5.0 (Linux; Android 14; Pixel 8; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/130.0.0.0 Mobile Safari/537.36 GSA/15.40.30.29.arm64',
    desktopFirefox: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14.0; rv:131.0) Gecko/20100101 Firefox/131.0',
    desktopSafari: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15',
    instagramIos: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 350.0.0.0 (iPhone15,2; iOS 18_0; en_US)',
    facebookIos: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [FBAN/FBIOS;FBAV/480.0.0.0]',
    androidWebView: 'Mozilla/5.0 (Linux; Android 14; Pixel 8; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/130.0.0.0 Mobile Safari/537.36',
    tiktokAndroid: 'Mozilla/5.0 (Linux; Android 14; Pixel 8; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/130.0.0.0 Mobile Safari/537.36 musical_ly_2023',
    bareWkWebView: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148',
  }

  it.each(['iosSafari', 'iosChrome', 'iosFirefox', 'iosGoogleApp', 'androidChrome', 'samsung', 'androidGoogleApp', 'desktopFirefox', 'desktopSafari'] as const)('lets %s use Google', (name) => {
    expect(isEmbeddedBrowser(UA[name])).toBe(false)
  })

  it.each(['instagramIos', 'facebookIos', 'androidWebView', 'tiktokAndroid', 'bareWkWebView'] as const)('flags %s as an in-app browser', (name) => {
    expect(isEmbeddedBrowser(UA[name])).toBe(true)
  })

  it('treats a missing user agent as a normal browser', () => {
    expect(isEmbeddedBrowser('')).toBe(false)
    expect(isEmbeddedBrowser(undefined)).toBe(false)
  })
})

describe('resolveAuthDomain', () => {
  const env = 'landly-be752.firebaseapp.com'
  it.each(['www.golandly.com', 'golandly.com', 'GOLANDLY.com'])('serves the helper first-party on %s once the proxy is on', (host) => {
    expect(resolveAuthDomain({ host, envAuthDomain: env, proxyEnabled: true })).toBe(host.toLowerCase())
  })
  it.each(['www.golandly.com', 'golandly.com'])('keeps firebaseapp.com on %s while the flag is off', (host) => {
    expect(resolveAuthDomain({ host, envAuthDomain: env, proxyEnabled: false })).toBe(env)
  })
  it.each([null, 'localhost:3000', '192.168.7.57:3000', 'landly-git-branch.vercel.app', 'app.golandly.com'])('keeps the env value on %s', (host) => {
    expect(resolveAuthDomain({ host, envAuthDomain: env, proxyEnabled: true })).toBe(env)
  })
})

describe('next.config.js', () => {
  const config = createRequire(import.meta.url)('../../next.config.js')
  afterEach(() => vi.unstubAllEnvs())

  it('proxies the auth helper paths to the project firebaseapp.com host, keeping the path', async () => {
    vi.stubEnv('NEXT_PUBLIC_FIREBASE_PROJECT_ID', 'landly-dev')
    const rewrites = await config.rewrites()
    expect(rewrites).toEqual(
      expect.arrayContaining([
        { source: '/__/auth/:path*', destination: 'https://landly-dev.firebaseapp.com/__/auth/:path*' },
        { source: '/__/firebase/:path*', destination: 'https://landly-dev.firebaseapp.com/__/firebase/:path*' },
      ])
    )
  })

  it('adds no proxy (and never defaults to production) without a project ID', async () => {
    vi.stubEnv('NEXT_PUBLIC_FIREBASE_PROJECT_ID', '')
    expect(await config.rewrites()).toEqual([])
  })
})

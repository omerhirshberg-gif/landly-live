import { createRequire } from 'node:module'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  setPersistence: vi.fn(), popup: vi.fn(), redirect: vi.fn(), redirectResult: vi.fn(), finish: vi.fn(),
}))
vi.mock('firebase/auth', () => ({
  setPersistence: mocks.setPersistence,
  signInWithPopup: mocks.popup,
  signInWithRedirect: mocks.redirect,
  getRedirectResult: mocks.redirectResult,
}))
vi.mock('@/lib/firebase/config', () => ({ auth: { name: 'auth' }, googleProvider: { providerId: 'google.com' } }))
vi.mock('@/lib/auth/signInCustomer', () => ({ finishCustomerGoogleSignIn: mocks.finish }))

import { completeGoogleRedirect, isEmbeddedBrowser, shouldFallBackToRedirect, startGoogleWebSignIn } from '@/lib/auth/googleWebSignIn'
import { resolveAuthDomain } from '@/lib/firebase/authDomain'

const firebaseError = (code: string) => Object.assign(new Error(code), { code })
const persistence = { type: 'LOCAL' } as never
const signedIn = { status: 'signedIn', user: { uid: 'u1' }, preferredLanguage: null }

beforeEach(() => {
  vi.clearAllMocks()
  mocks.setPersistence.mockResolvedValue(undefined)
  mocks.redirect.mockResolvedValue(undefined)
  mocks.finish.mockResolvedValue(signedIn)
})

describe('startGoogleWebSignIn', () => {
  it('uses the popup and the shared customer rules when it works', async () => {
    mocks.popup.mockResolvedValue({ user: { uid: 'u1' } })
    expect(await startGoogleWebSignIn('he', persistence)).toEqual({ kind: 'signedIn', result: signedIn })
    expect(mocks.setPersistence).toHaveBeenCalledWith({ name: 'auth' }, persistence)
    expect(mocks.setPersistence.mock.invocationCallOrder[0]).toBeLessThan(mocks.popup.mock.invocationCallOrder[0])
    expect(mocks.finish).toHaveBeenCalledWith({ user: { uid: 'u1' } }, 'he')
    expect(mocks.redirect).not.toHaveBeenCalled()
  })

  it.each(['auth/popup-blocked', 'auth/operation-not-supported-in-this-environment'])('falls back to a redirect on %s', async (code) => {
    mocks.popup.mockRejectedValue(firebaseError(code))
    expect(await startGoogleWebSignIn('en', persistence)).toEqual({ kind: 'redirecting' })
    expect(mocks.redirect).toHaveBeenCalledWith({ name: 'auth' }, { providerId: 'google.com' })
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
    expect(mocks.finish).toHaveBeenCalledWith({ user: { uid: 'u1' } }, 'fr')
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
  it('serves the helper first-party on production once the proxy is on', () => {
    expect(resolveAuthDomain({ host: 'www.golandly.com', envAuthDomain: env, proxyEnabled: true })).toBe('www.golandly.com')
  })
  it('keeps firebaseapp.com while the flag is off', () => {
    expect(resolveAuthDomain({ host: 'www.golandly.com', envAuthDomain: env, proxyEnabled: false })).toBe(env)
  })
  it.each([null, 'localhost:3000', '192.168.7.57:3000', 'landly-git-branch.vercel.app', 'golandly.com'])('keeps the env value on %s', (host) => {
    expect(resolveAuthDomain({ host, envAuthDomain: env, proxyEnabled: true })).toBe(env)
  })
})

describe('next.config.js', () => {
  it('proxies the auth helper paths to the project firebaseapp.com host, keeping the path', async () => {
    const config = createRequire(import.meta.url)('../../next.config.js')
    const rewrites = await config.rewrites()
    expect(rewrites).toEqual(
      expect.arrayContaining([
        { source: '/__/auth/:path*', destination: 'https://landly-be752.firebaseapp.com/__/auth/:path*' },
        { source: '/__/firebase/:path*', destination: 'https://landly-be752.firebaseapp.com/__/firebase/:path*' },
      ])
    )
  })
})

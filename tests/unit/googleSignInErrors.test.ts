import { describe, expect, it } from 'vitest'
import { FirebaseError } from 'firebase/app'
import { describeAuthError, isAuthCancellation } from '@/lib/firebase/authErrors'
import { translations, type Lang } from '@/lib/i18n/translations'

// A runtime-only import: a typed one would pull the app's @shared paths into the root typecheck.
const modulePath = '../../landly-mobile/src/auth/googleSignInErrors'
const { translateGoogleNativeError } = (await import(modulePath)) as {
  translateGoogleNativeError: (err: unknown, codes: Record<'SIGN_IN_CANCELLED' | 'IN_PROGRESS' | 'PLAY_SERVICES_NOT_AVAILABLE', string>) => FirebaseError
}

const CODES = { SIGN_IN_CANCELLED: '12501', IN_PROGRESS: 'IN_PROGRESS', PLAY_SERVICES_NOT_AVAILABLE: 'PLAY_SERVICES_NOT_AVAILABLE' }

describe('Android Google sign-in error mapping', () => {
  it('keeps the library\'s own cases', () => {
    expect(translateGoogleNativeError({ code: '12501' }, CODES).code).toBe('auth/popup-closed-by-user')
    expect(translateGoogleNativeError({ code: 'IN_PROGRESS' }, CODES).code).toBe('auth/cancelled-popup-request')
    expect(translateGoogleNativeError({ code: 'PLAY_SERVICES_NOT_AVAILABLE' }, CODES).code).toBe('auth/google-play-services-unavailable')
    expect(isAuthCancellation(translateGoogleNativeError({ code: '12501' }, CODES))).toBe(true)
  })

  it('names a wrong signing key or client (DEVELOPER_ERROR, code 10) instead of calling it internal', () => {
    for (const err of [{ code: '10', message: 'x' }, { code: 'DEVELOPER_ERROR' }, { message: '[28444] Developer console is not set up correctly.' }, { message: 'DEVELOPER_ERROR (10)' }]) {
      expect(translateGoogleNativeError(err, CODES).code).toBe('auth/google-config-error')
    }
  })

  it('names a network failure, and keeps the native detail of anything else for the log', () => {
    expect(translateGoogleNativeError({ code: '7', message: 'A network error has occurred' }, CODES).code).toBe('auth/network-request-failed')
    const other = translateGoogleNativeError({ code: 'weird', message: 'boom' }, CODES)
    expect(other.code).toBe('auth/internal-error')
    expect(other.message).toContain('code=weird')
    expect(other.message).toContain('boom')
    expect(translateGoogleNativeError(null, CODES).code).toBe('auth/internal-error')
  })

  it('says a setup failure with its code on screen, and a network failure without one', () => {
    expect(describeAuthError(new FirebaseError('auth/google-config-error', 'x'), { provider: 'google' })).toEqual({ key: 'autherr_googleConfig', code: 'auth/google-config-error' })
    expect(describeAuthError(new FirebaseError('auth/network-request-failed', 'x'), { provider: 'google' })).toEqual({ key: 'autherr_network', code: null })
  })

  it('has the setup message in every language', () => {
    for (const lang of Object.keys(translations) as Lang[]) expect(translations[lang].autherr_googleConfig).toBeTruthy()
  })
})

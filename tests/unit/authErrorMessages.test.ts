import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { FirebaseError } from 'firebase/app'
import { authErrorDetail, describeAuthError, isAuthCancellation, withIsolatedCode } from '@/lib/firebase/authErrors'
import { translations, type Lang } from '@/lib/i18n/translations'
import { assessRow, classifyAppleAuthorize, classifyTokenExchange, nativeAppleSignInStatus, parseAuthUri } from '../../scripts/lib/appleOAuth.mjs'

const LANGS = Object.keys(translations) as Lang[]
const fbErr = (code: string) => new FirebaseError(code, 'x')

// Every code the sign-in screens give a message of their own.
const KNOWN_CODES = [
  'auth/popup-closed-by-user',
  'auth/cancelled-popup-request',
  'auth/user-cancelled',
  'auth/popup-blocked',
  'auth/network-request-failed',
  'auth/timeout',
  'auth/too-many-requests',
  'auth/invalid-credential',
  'auth/user-not-found',
  'auth/wrong-password',
  'auth/invalid-email',
  'auth/weak-password',
  'auth/email-already-in-use',
  'auth/account-exists-with-different-credential',
  'auth/unverified-provider-email',
  'auth/user-disabled',
  'auth/operation-not-allowed',
  'auth/web-storage-unsupported',
  'auth/operation-not-supported-in-this-environment',
]

describe('sign-in error messages', () => {
  it('gives every known code its own message, in all five languages', () => {
    for (const code of KNOWN_CODES) {
      for (const provider of [undefined, 'google', 'apple'] as const) {
        const { key, code: shown } = describeAuthError(fbErr(code), { provider })
        expect(key, code).not.toBe('autherr_generic')
        // Only a Google or Apple failure carries its code along.
        expect(shown).toBe(provider && code === 'auth/invalid-credential' ? code : null)
        for (const lang of LANGS) expect(translations[lang][key], `${lang} ${key}`).toBeTruthy()
      }
    }
  })

  it("never blames an email or password for an Apple or Google failure, and shows its code", () => {
    for (const code of ['auth/invalid-credential', 'auth/missing-or-invalid-nonce', 'auth/invalid-auth-event']) {
      expect(describeAuthError(fbErr(code), { provider: 'apple' })).toEqual({ key: 'autherr_appleFailed', code })
      expect(describeAuthError(fbErr(code), { provider: 'google' })).toEqual({ key: 'autherr_googleFailed', code })
    }
    for (const lang of LANGS) {
      for (const key of ['autherr_appleFailed', 'autherr_googleFailed'] as const) {
        expect(translations[lang][key]).not.toBe(translations[lang].autherr_badCredentials)
      }
    }
    expect(translations.en.autherr_appleFailed).not.toMatch(/email|password/i)
    // Email sign-in keeps its own wording.
    expect(describeAuthError(fbErr('auth/invalid-credential'))).toEqual({ key: 'autherr_badCredentials', code: null })
  })

  it("pulls Apple's reason out of Firebase's error for the log", () => {
    // What the Firebase SDK puts in the message for INVALID_IDP_RESPONSE (trimmed).
    const err = new FirebaseError(
      'auth/invalid-credential',
      'Error getting access token from https://appleid.apple.com, OAuth2 redirect uri is: https://www.golandly.com/__/auth/handler, ' +
        'response: OAuth2TokenResponse{params: error=invalid_grant&error_description=The%20code%20has%20expired%20or%20has%20been%20revoked., httpMetadata: HttpMetadata{status=400}}',
    )
    expect(authErrorDetail(err)).toEqual({
      error: 'invalid_grant',
      errorDescription: 'The code has expired or has been revoked.',
      redirectUri: 'https://www.golandly.com/__/auth/handler',
      audience: null,
      expectedAudience: null,
    })
    expect(authErrorDetail(new FirebaseError('auth/invalid-credential', 'Firebase: Error (auth/invalid-credential).'))).toBeNull()
    expect(authErrorDetail(null)).toBeNull()
    expect(authErrorDetail({ message: 42 })).toBeNull()
  })

  it("names the native Apple token's audience and the one Firebase expected, in the log only", () => {
    for (const expected of ['com.amitbd.landlyapp.web.dev', 'com.amitbd.landlyapp.web']) {
      const err = new FirebaseError(
        'auth/invalid-credential',
        `Firebase: The audience in ID Token [com.amitbd.landlyapp] does not match the expected audience ${expected}. (auth/invalid-credential).`,
      )
      expect(authErrorDetail(err)).toEqual({
        error: null,
        errorDescription: null,
        redirectUri: null,
        audience: 'com.amitbd.landlyapp',
        expectedAudience: expected,
      })
      // On screen it stays the plain code, isolated in the Hebrew sentence.
      expect(describeAuthError(err, { provider: 'apple' })).toEqual({ key: 'autherr_appleFailed', code: 'auth/invalid-credential' })
      expect(withIsolatedCode(translations.he.autherr_appleFailed, 'auth/invalid-credential')).toBe(
        `${translations.he.autherr_appleFailed} \u2066(auth/invalid-credential)\u2069`,
      )
    }
  })

  it("puts Apple's own reason after the code, and only an OAuth error name", () => {
    const appleSaid = (error: string) =>
      new FirebaseError(
        'auth/invalid-credential',
        `Error getting access token from https://appleid.apple.com, OAuth2 redirect uri is: https://www.golandly.com/__/auth/handler, response: OAuth2TokenResponse{params: error=${error}&error_description=x}`,
      )
    expect(describeAuthError(appleSaid('invalid_grant'), { provider: 'apple' })).toEqual({
      key: 'autherr_appleFailed',
      code: 'auth/invalid-credential · invalid_grant',
    })
    expect(describeAuthError(appleSaid('<script>'), { provider: 'apple' }).code).toBe('auth/invalid-credential')
    // The email form never shows a provider's reason (there isn't one).
    expect(describeAuthError(appleSaid('invalid_grant'))).toEqual({ key: 'autherr_badCredentials', code: null })
    expect(withIsolatedCode(translations.he.autherr_appleFailed, 'auth/invalid-credential · invalid_grant')).toBe(
      `${translations.he.autherr_appleFailed} \u2066(auth/invalid-credential · invalid_grant)\u2069`,
    )
  })

  it("says the app's native Apple sheet failed, with iOS's code, and stays quiet on a cancel", () => {
    for (const code of ['ERR_REQUEST_UNKNOWN', 'ERR_REQUEST_FAILED', 'ERR_REQUEST_NOT_HANDLED', 'ERR_REQUEST_INVALID_RESPONSE', 'ERR_REQUEST_NOT_INTERACTIVE']) {
      const err = Object.assign(new Error('The authorization attempt failed for an unknown reason'), { code })
      expect(describeAuthError(err, { provider: 'apple' })).toEqual({ key: 'autherr_appleFailed', code })
      expect(describeAuthError(err)).toEqual({ key: 'autherr_appleFailed', code })
      expect(isAuthCancellation(err)).toBe(false)
    }
    for (const code of ['ERR_REQUEST_CANCELED', 'auth/popup-closed-by-user', 'auth/cancelled-popup-request', 'auth/user-cancelled']) {
      expect(isAuthCancellation({ code }), code).toBe(true)
    }
    expect(describeAuthError({ code: 'ERR_REQUEST_CANCELED' })).toEqual({ key: 'autherr_cancelled', code: null })
    expect(isAuthCancellation(fbErr('auth/invalid-credential'))).toBe(false)
    expect(isAuthCancellation(null)).toBe(false)

    const native = readFileSync('landly-mobile/src/auth/appleSignIn.ts', 'utf8')
    expect(native).toMatch(/console\.warn\('\[auth\] Apple sheet failed:'/)
    const app = readFileSync('landly-mobile/src/app/(auth)/login.tsx', 'utf8')
    expect(app).toMatch(/if \(!isAuthCancellation\(err\)\) showAuthError\(err, provider\)/)
  })

  it('falls back to the generic message plus the code for anything else', () => {
    expect(describeAuthError(fbErr('auth/internal-error'), { provider: 'apple' })).toEqual({ key: 'autherr_generic', code: 'auth/internal-error' })
    expect(describeAuthError(new Error('boom'))).toEqual({ key: 'autherr_generic', code: null })
    expect(describeAuthError(null)).toEqual({ key: 'autherr_generic', code: null })
  })

  it('ends each Hebrew message with its own full stop and isolates the code left-to-right', () => {
    for (const [key, text] of Object.entries(translations.he)) {
      if (key.startsWith('autherr_')) expect(text, key).toMatch(/\.$/)
    }
    const shown = withIsolatedCode(translations.he.autherr_generic, 'auth/internal-error')
    expect(shown).toBe(`${translations.he.autherr_generic} ⁦(auth/internal-error)⁩`)
    expect(withIsolatedCode('x.', null)).toBe('x.')
  })

  it('wires both sign-in screens to the translated messages', () => {
    const web = readFileSync('components/auth/entrance/AuthScreen.tsx', 'utf8')
    expect(web).not.toMatch(/getAuthErrorMessage/)
    expect(web).toMatch(/<bdi dir="ltr">\(\{error\.code\}\)<\/bdi>/)
    expect(web).toMatch(/showAuthError\(err, provider\)/)
    expect(web).toMatch(/showAuthError\(err, redirectProvider\)/)
    const app = readFileSync('landly-mobile/src/app/(auth)/login.tsx', 'utf8')
    expect(app).not.toMatch(/getAuthErrorMessage/)
    expect(app).toMatch(/withIsolatedCode\(t\(error\.key\), error\.code\)/)
    expect(app).toMatch(/showAuthError\(err, provider\)/)
  })
})

// Recorded from appleid.apple.com/auth/authorize (trimmed).
const APPLE_ACCEPTED = '<html><head><title>Sign in with Apple ID</title></head><body><div id="sign_in_form"></div></body></html>'
const APPLE_BAD_REDIRECT = '<script>window.appleAuth = {"errorCode":"invalid_request","errorMessage":"Invalid web redirect url."}</script>'
const APPLE_BAD_CLIENT = '<script>window.appleAuth = {"errorCode":"invalid_client"}</script>'
const authUri = (clientId: string, host: string) =>
  `https://appleid.apple.com/auth/authorize?response_type=code&client_id=${clientId}&redirect_uri=${encodeURIComponent(`https://${host}/__/auth/handler`)}&state=s`

describe('check:apple', () => {
  it("reads Apple's answer", () => {
    expect(classifyAppleAuthorize(200, APPLE_ACCEPTED)).toBe('accepted')
    expect(classifyAppleAuthorize(200, APPLE_BAD_REDIRECT)).toBe('bad-redirect')
    expect(classifyAppleAuthorize(200, APPLE_BAD_CLIENT)).toBe('bad-client')
    expect(classifyAppleAuthorize(500, '')).toBe('error')
  })

  it('reads the Services ID and Return URL Firebase sends', () => {
    expect(parseAuthUri(authUri('com.amitbd.landlyapp.web', 'www.golandly.com'))).toEqual({
      origin: 'https://appleid.apple.com',
      clientId: 'com.amitbd.landlyapp.web',
      redirectUri: 'https://www.golandly.com/__/auth/handler',
    })
  })

  it("reads Apple's answer to Firebase redeeming a made-up code", () => {
    const answer = (error: string) =>
      `INVALID_IDP_RESPONSE : Error getting access token from https://appleid.apple.com, OAuth2 redirect uri is: https://x/__/auth/handler, response: OAuth2TokenResponse{params: error=${error}&error_description=x, httpMetadata: HttpMetadata{status=400}}`
    expect(classifyTokenExchange(answer('invalid_grant'))).toBe('sent')
    expect(classifyTokenExchange(answer('invalid_client'))).toBe('no-key')
    expect(classifyTokenExchange('MISSING_OR_INVALID_NONCE : Duplicate credential received.')).toBe('unknown')
    expect(classifyTokenExchange(undefined)).toBe('unknown')
  })

  it("checks the app's local iOS project for the Sign in with Apple entitlement", () => {
    const appJson = JSON.parse(readFileSync('landly-mobile/app.json', 'utf8'))
    const plist = (dict: string) =>
      `<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">\n<plist version="1.0">\n${dict}\n</plist>`
    // The project generated before ios.usesAppleSignIn was added.
    expect(nativeAppleSignInStatus({ appJson, entitlements: plist('<dict/>') })).toBe('stale-build')
    const granted = plist(
      '<dict>\n  <key>aps-environment</key>\n  <string>development</string>\n  <key>com.apple.developer.applesignin</key>\n  <array>\n    <string>Default</string>\n  </array>\n</dict>',
    )
    expect(nativeAppleSignInStatus({ appJson, entitlements: granted })).toBe('ok')
    expect(nativeAppleSignInStatus({ appJson, entitlements: null })).toBe('no-native-project')
    const withoutFlag = { expo: { ...appJson.expo, ios: { ...appJson.expo.ios, usesAppleSignIn: false } } }
    expect(nativeAppleSignInStatus({ appJson: withoutFlag, entitlements: granted })).toBe('missing-config')
    const withoutPlugin = { expo: { ...appJson.expo, plugins: appJson.expo.plugins.filter((p: unknown) => p !== 'expo-apple-authentication') } }
    expect(nativeAppleSignInStatus({ appJson: withoutPlugin, entitlements: granted })).toBe('missing-config')
  })

  it('passes a row only with the right Services ID for the project, Apple accepting and a working key', () => {
    const SECRET_SENT = 'INVALID_IDP_RESPONSE : ... OAuth2TokenResponse{params: error=invalid_grant&error_description=x}'
    const NO_SECRET = 'INVALID_IDP_RESPONSE : ... OAuth2TokenResponse{params: error=invalid_client}'
    const prod = { projectId: 'landly-be752', host: 'www.golandly.com', status: 200, exchangeMessage: SECRET_SENT }
    expect(assessRow({ ...prod, exchangeMessage: NO_SECRET, authUri: authUri('com.amitbd.landlyapp.web', prod.host), body: APPLE_ACCEPTED })).toMatchObject({
      ok: false,
      exchange: 'no-key',
    })
    expect(assessRow({ ...prod, authUri: authUri('com.amitbd.landlyapp.web', prod.host), body: APPLE_ACCEPTED }).ok).toBe(true)
    expect(assessRow({ ...prod, authUri: authUri('com.amitbd.landlyapp.web', prod.host), body: APPLE_BAD_REDIRECT })).toMatchObject({
      ok: false,
      apple: 'bad-redirect',
    })
    // PROD must never send DEV's Services ID, and the other way round.
    expect(assessRow({ ...prod, authUri: authUri('com.amitbd.landlyapp.web.dev', prod.host), body: APPLE_ACCEPTED }).ok).toBe(false)
    const dev = { projectId: 'landly-dev', host: 'landly-dev.firebaseapp.com', status: 200, exchangeMessage: SECRET_SENT }
    expect(assessRow({ ...dev, authUri: authUri('com.amitbd.landlyapp.web.dev', dev.host), body: APPLE_ACCEPTED }).ok).toBe(true)
    expect(assessRow({ ...dev, authUri: authUri('com.amitbd.landlyapp.web', dev.host), body: APPLE_ACCEPTED }).ok).toBe(false)
  })
})

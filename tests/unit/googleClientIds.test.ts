import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { afterEach, describe, expect, it } from 'vitest'

// Native Google sign-in uses one OAuth client per platform: app.config.js
// passes both IDs to the app, and googleSignIn.ts picks this platform's.
const require = createRequire(import.meta.url)
const CONFIG = require.resolve('../../landly-mobile/app.config.js')
const IOS = '111-ios.apps.googleusercontent.com'
const ANDROID = '222-android.apps.googleusercontent.com'
const saved = { ios: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID, android: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID }

function restore(name: string, value: string | undefined) {
  if (value === undefined) delete process.env[name]
  else process.env[name] = value
}

function appConfig(ios?: string, android?: string) {
  restore('EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID', ios)
  restore('EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID', android)
  delete require.cache[CONFIG]
  return require(CONFIG)({ config: { scheme: 'landly', extra: {} } })
}

afterEach(() => {
  restore('EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID', saved.ios)
  restore('EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID', saved.android)
  delete require.cache[CONFIG]
})

describe('Google client IDs', () => {
  it('passes each platform its own client ID, with its reversed ID as a redirect scheme', () => {
    const config = appConfig(IOS, ANDROID)
    expect(config.extra.googleClientIds).toEqual({ ios: IOS, android: ANDROID })
    expect(config.scheme).toEqual(['landly', 'com.googleusercontent.apps.111-ios', 'com.googleusercontent.apps.222-android'])
  })

  it('leaves a platform unconfigured when its ID is unset', () => {
    const config = appConfig(IOS, undefined)
    expect(config.extra.googleClientIds).toEqual({ ios: IOS, android: undefined })
    expect(config.scheme).toEqual(['landly', 'com.googleusercontent.apps.111-ios'])
  })

  it('signs in on iOS with the iOS client, on Android with the Android client, and never natively on web', async () => {
    const native = await readFile('landly-mobile/src/auth/googleSignIn.ts', 'utf8')
    const web = await readFile('landly-mobile/src/auth/googleSignIn.web.ts', 'utf8')
    expect(native).toContain(
      "const clientId = Platform.OS === 'ios' ? clientIds.ios : Platform.OS === 'android' ? clientIds.android : undefined"
    )
    expect(native).toContain('export const GOOGLE_SIGN_IN_CONFIGURED = !!clientId')
    // The browser build is the Firebase popup, with no native client ID.
    expect(web).toContain('signInWithPopup(auth, googleProvider)')
    expect(web).not.toMatch(/googleClientIds|clientId/)
  })
})

import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { afterEach, describe, expect, it } from 'vitest'

// Google sign-in: iOS uses its own OAuth client (and a reversed-ID redirect
// scheme); Android uses the native Google sheet and only the project's web
// client ID. app.config.js passes both IDs to the app.
const require = createRequire(import.meta.url)
const CONFIG = require.resolve('../../landly-mobile/app.config.js')
const IOS = '111-ios.apps.googleusercontent.com'
const WEB = '333-web.apps.googleusercontent.com'
const saved = { ios: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID, web: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID }

function restore(name: string, value: string | undefined) {
  if (value === undefined) delete process.env[name]
  else process.env[name] = value
}

function appConfig(ios?: string, web?: string) {
  restore('EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID', ios)
  restore('EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID', web)
  delete require.cache[CONFIG]
  return require(CONFIG)({ config: { scheme: 'landly', extra: {} } })
}

afterEach(() => {
  restore('EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID', saved.ios)
  restore('EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID', saved.web)
  delete require.cache[CONFIG]
})

describe('Google client IDs', () => {
  it('passes the iOS and web client IDs, with only the iOS reversed ID as a redirect scheme', () => {
    const config = appConfig(IOS, WEB)
    expect(config.extra.googleClientIds).toEqual({ ios: IOS, web: WEB })
    expect(config.scheme).toEqual(['landly', 'com.googleusercontent.apps.111-ios'])
  })

  it('leaves each platform unconfigured when its ID is unset', () => {
    const config = appConfig(undefined, WEB)
    expect(config.extra.googleClientIds).toEqual({ ios: undefined, web: WEB })
    expect(config.scheme).toEqual(['landly'])
    expect(appConfig(IOS, undefined).extra.googleClientIds.web).toBeUndefined()
  })

  it('keeps iOS on the browser flow, Android on the native SDK, and the browser build native-free', async () => {
    const ios = await readFile('landly-mobile/src/auth/googleSignIn.ts', 'utf8')
    const android = await readFile('landly-mobile/src/auth/googleSignIn.android.ts', 'utf8')
    const web = await readFile('landly-mobile/src/auth/googleSignIn.web.ts', 'utf8')
    expect(ios).toContain('googleClientIds?.ios')
    expect(ios).not.toContain('google-signin')
    expect(android).toContain('@react-native-google-signin/google-signin')
    expect(android).toContain('googleClientIds?.web')
    // The browser build is the Firebase popup, with no native client ID or module.
    expect(web).toContain('signInWithPopup(auth, googleProvider)')
    expect(web).not.toMatch(/googleClientIds|clientId|google-signin/)
  })

  it('leaves the Google SDK out of iOS autolinking', () => {
    const config = require('../../landly-mobile/react-native.config.js')
    expect(config.dependencies['@react-native-google-signin/google-signin'].platforms.ios).toBeNull()
  })
})

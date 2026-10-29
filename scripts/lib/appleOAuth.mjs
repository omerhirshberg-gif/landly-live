// The pure half of scripts/check-apple-oauth.mjs, kept free of network and
// file access so tests/unit/checkAppleOAuth.test.ts can feed it recorded
// responses.

/** The Services ID each Firebase project's Apple provider must send. */
export const EXPECTED_APPLE_CLIENT_IDS = {
  'landly-dev': 'com.amitbd.landlyapp.web.dev',
  'landly-be752': 'com.amitbd.landlyapp.web',
}

/** client_id and redirect_uri from the Apple authorize URL Firebase built. */
export function parseAuthUri(authUri) {
  const url = new URL(authUri)
  return {
    origin: url.origin,
    clientId: url.searchParams.get('client_id'),
    redirectUri: url.searchParams.get('redirect_uri'),
  }
}

/**
 * What Apple's authorize page says about a request:
 *   bad-redirect -- the redirect_uri isn't a Return URL of the Services ID
 *   bad-client   -- Apple doesn't know the Services ID
 *   accepted     -- Apple would show its sign-in page
 */
export function classifyAppleAuthorize(status, body) {
  const text = String(body ?? '')
  if (/Invalid web redirect url/i.test(text) || /"errorCode"\s*:\s*"invalid_request"/.test(text)) return 'bad-redirect'
  if (/invalid_client/.test(text)) return 'bad-client'
  if (status >= 400) return 'error'
  return 'accepted'
}

/**
 * What Apple's token endpoint said when Firebase redeemed a made-up code
 * (accounts:signInWithIdp's error message):
 *   key-ok    -- invalid_grant: Apple accepted the client secret Firebase
 *                signs with the project's Team ID, Key ID and private key,
 *                and only refused the code
 *   bad-key   -- invalid_client: that Apple configuration in Firebase is wrong
 *   unknown   -- anything else (shown as is)
 */
export function classifyTokenExchange(message) {
  const error = String(message ?? '').match(/[{\s,&]error=([^&,}\s]+)/)?.[1]
  if (error === 'invalid_grant') return 'key-ok'
  if (error === 'invalid_client') return 'bad-key'
  return 'unknown'
}

/** The audience Apple's native sheet signs into its identity token: the app's bundle ID. */
export const NATIVE_APPLE_AUDIENCE = 'com.amitbd.landlyapp'

/**
 * What Firebase said when handed an unsigned Apple identity token whose aud
 * is the app's bundle ID (accounts:signInWithIdp's error message). Firebase
 * checks the audience before the nonce, so:
 *   native-ok     -- MISSING_OR_INVALID_NONCE: the audience was accepted (the
 *                    bundle ID is a registered iOS app of the project)
 *   aud-mismatch  -- "The audience in ID Token [...] does not match the
 *                    expected audience ...": register an iOS app with the
 *                    bundle ID in the project, or the app's Apple sign-in
 *                    fails with auth/invalid-credential
 *   unknown       -- anything else (shown as is)
 */
export function classifyNativeAudience(message) {
  const text = String(message ?? '')
  const mismatch = text.match(/audience in ID Token \[([^\]]*)\] does not match the expected audience ([^\s,]+?)\.?(?:\s|,|$)/)
  if (mismatch) return { status: 'aud-mismatch', audience: mismatch[1], expectedAudience: mismatch[2] }
  if (/^MISSING_OR_INVALID_NONCE\b/.test(text)) return { status: 'native-ok', audience: null, expectedAudience: null }
  return { status: 'unknown', audience: null, expectedAudience: null }
}

/** One row of the report; ok only when Apple accepts, the client is the expected one and the key works. */
export function assessRow({ projectId, host, authUri, status, body, exchangeMessage }) {
  const { origin, clientId, redirectUri } = parseAuthUri(authUri)
  const expectedClientId = EXPECTED_APPLE_CLIENT_IDS[projectId] ?? null
  const apple = origin === 'https://appleid.apple.com' ? classifyAppleAuthorize(status, body) : 'not-apple'
  const exchange = classifyTokenExchange(exchangeMessage)
  const clientOk = expectedClientId !== null && clientId === expectedClientId
  return { projectId, host, clientId, expectedClientId, redirectUri, apple, exchange, ok: clientOk && apple === 'accepted' && exchange === 'key-ok' }
}

/**
 * Whether the app's local iOS project can use the native Apple sheet:
 *   ok                 -- app.json asks for it and Landly.entitlements has it
 *   missing-config     -- app.json lacks ios.usesAppleSignIn or the
 *                         expo-apple-authentication plugin
 *   stale-build        -- app.json asks for it but ios/ was generated before
 *                         that: iOS refuses the sheet (ERR_REQUEST_UNKNOWN)
 *                         until `npx expo prebuild --platform ios` and a rebuild
 *   no-native-project  -- no ios/ here (EAS builds generate it themselves)
 */
export function nativeAppleSignInStatus({ appJson, entitlements }) {
  const expo = appJson?.expo ?? {}
  const plugins = (expo.plugins ?? []).map((p) => (Array.isArray(p) ? p[0] : p))
  if (expo.ios?.usesAppleSignIn !== true || !plugins.includes('expo-apple-authentication')) return 'missing-config'
  if (entitlements == null) return 'no-native-project'
  const granted = /<key>com\.apple\.developer\.applesignin<\/key>\s*<array>\s*<string>Default<\/string>/.test(entitlements)
  return granted ? 'ok' : 'stale-build'
}

/**
 * Whether the app's local iOS project uses UIKit's scene life cycle, which
 * iOS 27 requires of apps built with its SDK (without it the app is stopped
 * the moment it opens). landly-mobile/plugins/withSceneLifecycle.js sets it up:
 *   ok                 -- Info.plist names SceneDelegate, the project compiles
 *                         it, and AppDelegate hands it the React Native factory
 *   stale-build        -- something is missing: `npx expo prebuild --platform ios`
 *   no-native-project  -- no ios/ here
 */
export function nativeSceneLifecycleStatus({ infoPlist, pbxproj, appDelegate, sceneDelegate }) {
  if (infoPlist == null) return 'no-native-project'
  const manifest =
    /<key>UIApplicationSceneManifest<\/key>/.test(infoPlist) &&
    /<key>UISceneDelegateClassName<\/key>\s*<string>\$\(PRODUCT_MODULE_NAME\)\.SceneDelegate<\/string>/.test(infoPlist)
  const compiled = /SceneDelegate\.swift in Sources/.test(pbxproj ?? '')
  const delegate = /class SceneDelegate: ExpoAppSceneDelegate\b/.test(sceneDelegate ?? '')
  const provider =
    /class AppDelegate: ExpoAppDelegate, ExpoReactNativeFactoryProvider\b/.test(appDelegate ?? '') &&
    !/factory\.startReactNative\(/.test(appDelegate ?? '')
  return manifest && compiled && delegate && provider ? 'ok' : 'stale-build'
}

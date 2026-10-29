// The pure half of scripts/check-apple-oauth.mjs and check-apple-key.mjs,
// kept free of network and file access so tests/unit/checkAppleOAuth.test.ts
// can feed it recorded responses.

import { createPrivateKey, sign } from 'node:crypto'

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
 * (accounts:signInWithIdp's error message). Apple judges the code before the
 * client secret's signature (a made-up code gets invalid_grant even with a
 * secret signed by a stranger's key), so this proves only that Firebase
 * sends a secret, never that its key is right: `npm run check:apple-key`
 * does that, with a real code.
 *   sent     -- invalid_grant: Firebase sent Apple a client secret
 *   no-key   -- invalid_client: it sent none (no key in its Apple provider)
 *   unknown  -- anything else (shown as is)
 */
export function classifyTokenExchange(message) {
  const error = String(message ?? '').match(/[{\s,&]error=([^&,}\s]+)/)?.[1]
  if (error === 'invalid_grant') return 'sent'
  if (error === 'invalid_client') return 'no-key'
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

/** One row of the report; ok only when Apple accepts, the client is the expected one and Firebase sends a secret. */
export function assessRow({ projectId, host, authUri, status, body, exchangeMessage }) {
  const { origin, clientId, redirectUri } = parseAuthUri(authUri)
  const expectedClientId = EXPECTED_APPLE_CLIENT_IDS[projectId] ?? null
  const apple = origin === 'https://appleid.apple.com' ? classifyAppleAuthorize(status, body) : 'not-apple'
  const exchange = classifyTokenExchange(exchangeMessage)
  const clientOk = expectedClientId !== null && clientId === expectedClientId
  return { projectId, host, clientId, expectedClientId, redirectUri, apple, exchange, ok: clientOk && apple === 'accepted' && exchange === 'sent' }
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

/** The Apple Developer team that owns the app, its Services IDs and the Sign in with Apple key. */
export const EXPECTED_APPLE_TEAM_ID = 'Q9PZPLU6GY'

/**
 * Problems with a Sign in with Apple key found before asking Apple (empty
 * when none): Team and Key IDs are 10 letters/digits, the .p8 must be an EC
 * P-256 private key, and Apple names the download AuthKey_<Key ID>.p8, so a
 * file named for another key means the Key ID and the key don't belong
 * together.
 */
export function appleKeyProblems({ teamId, keyId, privateKeyPem, fileName }) {
  const problems = []
  if (!/^[A-Z0-9]{10}$/.test(teamId ?? '')) problems.push(`Team ID ${JSON.stringify(teamId ?? '')} is not 10 letters/digits`)
  else if (teamId !== EXPECTED_APPLE_TEAM_ID) problems.push(`Team ID ${teamId} is not Landly's (${EXPECTED_APPLE_TEAM_ID})`)
  if (!/^[A-Z0-9]{10}$/.test(keyId ?? '')) problems.push(`Key ID ${JSON.stringify(keyId ?? '')} is not 10 letters/digits`)
  const named = String(fileName ?? '').match(/AuthKey_([A-Z0-9]{10})\.p8$/)?.[1]
  if (named && keyId && named !== keyId) problems.push(`the key file is AuthKey_${named}.p8 but the Key ID is ${keyId}: they belong to different keys`)
  try {
    const key = createPrivateKey(privateKeyPem ?? '')
    if (key.asymmetricKeyType !== 'ec' || key.asymmetricKeyDetails?.namedCurve !== 'prime256v1') problems.push('the .p8 is not an EC P-256 key')
  } catch {
    problems.push('the .p8 is not a readable private key')
  }
  return problems
}

const b64url = (value) => Buffer.from(typeof value === 'string' ? value : JSON.stringify(value)).toString('base64url')

/**
 * The client secret Firebase signs for Apple's token endpoint, as Apple
 * documents it: an ES256 JWT from the team (iss) for the Services ID (sub),
 * signed with the key (kid). `now` in seconds.
 */
export function appleClientSecret({ teamId, keyId, clientId, privateKeyPem, now, ttlSeconds = 300 }) {
  const input = `${b64url({ alg: 'ES256', kid: keyId })}.${b64url({ iss: teamId, iat: now, exp: now + ttlSeconds, aud: 'https://appleid.apple.com', sub: clientId })}`
  const signature = sign('sha256', Buffer.from(input), { key: createPrivateKey(privateKeyPem), dsaEncoding: 'ieee-p1363' })
  return `${input}.${signature.toString('base64url')}`
}

/**
 * Where `npm run check:apple-key` has Apple send its real code: a Return URL
 * each project's Services ID already lists, so nothing changes in the Apple
 * portal. response_mode=query (allowed when no scopes are asked for) puts
 * the code in the address bar, to be pasted back.
 */
export const APPLE_KEY_CHECK_RETURN_URLS = {
  'landly-dev': 'https://landly-dev.firebaseapp.com/__/auth/handler',
  'landly-be752': 'https://www.golandly.com/__/auth/handler',
}
export const APPLE_KEY_CHECK_STATE = 'landly-key-check'

export function appleKeyCheckAuthorizeUrl(projectId) {
  const params = new URLSearchParams({
    response_type: 'code',
    response_mode: 'query',
    client_id: EXPECTED_APPLE_CLIENT_IDS[projectId],
    redirect_uri: APPLE_KEY_CHECK_RETURN_URLS[projectId],
    state: APPLE_KEY_CHECK_STATE,
  })
  return `https://appleid.apple.com/auth/authorize?${params}`
}

/** The project, Services ID, Return URL and code from the address Apple sent the browser to; null if it isn't one. */
export function parseKeyCheckReturn(address) {
  let url
  try {
    url = new URL(String(address ?? '').trim())
  } catch {
    return null
  }
  const redirectUri = `${url.origin}${url.pathname}`
  const projectId = Object.keys(APPLE_KEY_CHECK_RETURN_URLS).find((id) => APPLE_KEY_CHECK_RETURN_URLS[id] === redirectUri)
  const code = url.searchParams.get('code')
  if (!projectId || !code || url.searchParams.get('state') !== APPLE_KEY_CHECK_STATE) return null
  return { projectId, clientId: EXPECTED_APPLE_CLIENT_IDS[projectId], redirectUri, code }
}

/**
 * Apple's token endpoint's answer to a real code. Apple checks the code
 * first, so only a real one reaches the client secret:
 *   key-ok      -- tokens: the key, Key ID and Team ID belong to this Services ID
 *   bad-key     -- invalid_client: they don't
 *   code-spent  -- invalid_grant: the code was used, expired (5 minutes) or
 *                  came for another Return URL; sign in again
 *   unknown     -- anything else
 */
export function classifyAppleTokenAnswer(status, json) {
  if (status === 200 && json && typeof json === 'object' && json.id_token) return 'key-ok'
  const error = json && typeof json === 'object' ? json.error : null
  if (error === 'invalid_client') return 'bad-key'
  if (error === 'invalid_grant') return 'code-spent'
  return 'unknown'
}

// Extends app.json with values that must match the web app exactly.
//
// Firebase: read from the repo-root .env and .env.local (the same NEXT_PUBLIC_FIREBASE_*
// values Next.js uses), so mobile and web always share one Firebase project
// and a purchase on the web shows up in the app. EXPO_PUBLIC_FIREBASE_*
// overrides each value for environments without the root .env (e.g. EAS).
//
// API base URL: the deployed web app, for the few calls the client makes to
// Next.js API routes (e.g. sending the verification email). It must be the
// final host: golandly.com redirects to www.golandly.com, and a cross-origin
// redirect drops the Authorization header. EXPO_PUBLIC_API_BASE_URL overrides
// it, e.g. with a LAN or tunnel URL of a local `next dev` (a phone can't reach
// "localhost"). Left unset, src/lib/env.ts picks the default: in development
// the `next dev` server on port 3000 of the machine running Metro, otherwise
// PRODUCTION_API_ORIGIN from lib/apiOrigin.ts.
// Expo Go keeps the manifest it loaded, so a change here needs a restart of
// `expo start` and a full reload of the app, not just Fast Refresh.
const fs = require('fs')
const path = require('path')
const { assertBuildEnvironment, resolveProfile } = require('./config/buildGuard')

// .env.local is read after .env and wins, as in Next.js -- that's where the
// landly-dev (staging) project lives for local development, so Expo and
// `next dev` share it.
function readRootEnv() {
  const env = {}
  for (const name of ['.env', '.env.local']) {
    const file = path.join(__dirname, '..', name)
    if (!fs.existsSync(file)) continue
    for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
      const match = line.match(/^\s*(NEXT_PUBLIC_FIREBASE_[A-Z_]+)\s*=\s*(.*?)\s*$/)
      if (match) env[match[1]] = match[2].replace(/^(['"])(.*)\1$/, '$2')
    }
  }
  return env
}

// An EAS build names its profile (EAS_BUILD_PROFILE). It reads only the EAS environment's EXPO_PUBLIC_* values: the
// root .env.local (landly-dev) is never a fallback there, so even `eas build --local` cannot bake DEV values into a
// production binary. Local runs (no profile) keep the root-env convenience.
// `eas update` sets no EAS_BUILD_PROFILE, so the update npm scripts name it in LANDLY_UPDATE_PROFILE; an update with no
// profile, an unknown one, or one that conflicts with the build profile throws (fails closed).
const resolved = resolveProfile({
  buildProfile: process.env.EAS_BUILD_PROFILE || undefined,
  updateProfile: process.env.LANDLY_UPDATE_PROFILE || undefined,
})
if (resolved.problems.length) throw new Error(`EAS update environment guard failed:\n - ${resolved.problems.join('\n - ')}`)
const buildProfile = resolved.profile
const rootEnv = buildProfile ? {} : readRootEnv()

// Native Google sign-in: iOS (src/auth/googleSignIn.ts) uses the iOS OAuth
// client, whose reversed ID is registered as a URL scheme so Google's
// redirect comes back to the app. Android (src/auth/googleSignIn.android.ts)
// uses Google's native sheet and needs only the project's *web* client ID:
// the app itself is identified by its package name and signing SHA-1 on the
// Android client in the Google Cloud console, so there is no scheme.
const googleClientIds = {
  ios: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID || undefined,
  web: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID || undefined,
}
const reversed = (id) => id.split('.').reverse().join('.')
const googleSchemes = googleClientIds.ios ? [reversed(googleClientIds.ios)] : []
const firebaseValue = (name) => process.env[`EXPO_PUBLIC_FIREBASE_${name}`] || rootEnv[`NEXT_PUBLIC_FIREBASE_${name}`]

// EAS: the project id and owner come from the environment (EAS_PROJECT_ID, EAS_OWNER), never from the repo.
// Left unset (local builds, Expo Go) the app config carries no EAS link. Apple Team ID and signing keys stay in
// EAS managed credentials and the web deployment's environment (see docs/STORE_RELEASE.md).
const eas = process.env.EAS_PROJECT_ID ? { projectId: process.env.EAS_PROJECT_ID } : undefined

// Hard fail: the profile's Firebase project and API origin must match (config/buildGuard.js).
assertBuildEnvironment({
  profile: buildProfile,
  projectId: firebaseValue('PROJECT_ID'),
  apiBaseUrl: process.env.EXPO_PUBLIC_API_BASE_URL,
})

// The dev-server local-network prompt text belongs to development builds only (Expo Go / dev client, local runs); a
// store binary never carries it.
function withoutDevOnlyPlist(config) {
  if (buildProfile === undefined || buildProfile === 'development') return config
  const { NSLocalNetworkUsageDescription: _dev, ...infoPlist } = config.ios?.infoPlist ?? {}
  return { ...config, ios: { ...config.ios, infoPlist } }
}

// EAS Update (silent OTA, applied on the next cold start). Only when the config knows its EAS project (an EAS build or
// update); Expo Go and local runs have none, so updates stay disabled there. Web ignores these keys.
// A named EAS profile (build or update) may also fall back to the project id in app.json.
function updatesFor(config) {
  const projectId = eas?.projectId || (buildProfile ? config.extra?.eas?.projectId : undefined)
  return projectId
    ? { url: `https://u.expo.dev/${projectId}`, enabled: true, checkAutomatically: 'ON_LOAD', fallbackToCacheTimeout: 0 }
    : { enabled: false }
}

module.exports = ({ config }) => ({
  ...withoutDevOnlyPlist(config),
  updates: updatesFor(config),
  ...(process.env.EAS_OWNER ? { owner: process.env.EAS_OWNER } : {}),
  scheme: [config.scheme, ...googleSchemes],
  extra: {
    ...config.extra,
    ...(eas ? { eas } : {}),
    firebase: {
      apiKey: firebaseValue('API_KEY'),
      authDomain: firebaseValue('AUTH_DOMAIN'),
      projectId: firebaseValue('PROJECT_ID'),
      storageBucket: firebaseValue('STORAGE_BUCKET'),
      messagingSenderId: firebaseValue('MESSAGING_SENDER_ID'),
      appId: firebaseValue('APP_ID'),
    },
    googleClientIds,
    apiBaseUrl: process.env.EXPO_PUBLIC_API_BASE_URL || undefined,
  },
})

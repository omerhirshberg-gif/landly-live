// Extends app.json with values that must match the web app exactly.
//
// Firebase: read from the repo-root .env (the same NEXT_PUBLIC_FIREBASE_*
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

function readRootEnv() {
  const file = path.join(__dirname, '..', '.env')
  if (!fs.existsSync(file)) return {}
  const env = {}
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    const match = line.match(/^\s*(NEXT_PUBLIC_FIREBASE_[A-Z_]+)\s*=\s*(.*?)\s*$/)
    if (match) env[match[1]] = match[2].replace(/^(['"])(.*)\1$/, '$2')
  }
  return env
}

const rootEnv = readRootEnv()

// Native Google sign-in (src/auth/googleSignIn.ts): one OAuth client per
// platform. Each client's reversed ID is registered as a URL scheme so
// Google's redirect comes back to the app.
const googleClientIds = {
  ios: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID || undefined,
  android: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID || undefined,
}
const reversed = (id) => id.split('.').reverse().join('.')
const googleSchemes = Object.values(googleClientIds).filter(Boolean).map(reversed)
const firebaseValue = (name) => process.env[`EXPO_PUBLIC_FIREBASE_${name}`] || rootEnv[`NEXT_PUBLIC_FIREBASE_${name}`]

module.exports = ({ config }) => ({
  ...config,
  scheme: [config.scheme, ...googleSchemes],
  extra: {
    ...config.extra,
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

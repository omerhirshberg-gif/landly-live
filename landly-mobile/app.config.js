// Extends app.json with values that must match the web app exactly.
//
// Firebase: read from the repo-root .env (the same NEXT_PUBLIC_FIREBASE_*
// values Next.js uses), so mobile and web always share one Firebase project
// and a purchase on the web shows up in the app. EXPO_PUBLIC_FIREBASE_*
// overrides each value for environments without the root .env (e.g. EAS).
//
// API base URL: the deployed web app, for the few calls the client makes to
// Next.js API routes (e.g. resending the verification email).
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
const firebaseValue = (name) => process.env[`EXPO_PUBLIC_FIREBASE_${name}`] || rootEnv[`NEXT_PUBLIC_FIREBASE_${name}`]

module.exports = ({ config }) => ({
  ...config,
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
    apiBaseUrl: process.env.EXPO_PUBLIC_API_BASE_URL || 'https://golandly.com',
  },
})

// Email + password logins for testing against landly-dev, e.g. in Expo Go,
// where Google sign-in isn't available.
//
//   node scripts/seed-dev-test-user.mjs --email you@example.com [--password <pw>]
//     adds (or replaces) a password on an existing landly-dev account, such
//     as one made with Google; its Google sign-in keeps working
//
//   node scripts/seed-dev-test-user.mjs --new [--email <addr>] [--password <pw>]
//     creates a verified test customer with onboarding done (default
//     qa.customer@example.com -- a reserved domain, so no one gets mail);
//     re-running resets its password
//
// Add --dry-run to see what would happen without writing. Without
// --password a strong one is generated. The password is printed once, to
// this terminal, and never written anywhere.
//
// Runs only against landly-dev: the env files are merged the way Next.js
// merges them (.env.local over .env) and both the Admin and the client
// project must be landly-dev, so production values can never be picked up.
// Needs Node 22.18+ (parseEnv).

import { existsSync, readFileSync } from 'node:fs'
import { randomBytes } from 'node:crypto'
import { join } from 'node:path'
import { parseEnv } from 'node:util'
import { cert, initializeApp } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { FieldValue, getFirestore } from 'firebase-admin/firestore'

const DEV_PROJECT_ID = 'landly-dev'
const DEFAULT_TEST_EMAIL = 'qa.customer@example.com'

const args = process.argv.slice(2)
const flag = (name) => args.includes(name)
const option = (name) => {
  const i = args.indexOf(name)
  return i >= 0 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : undefined
}
const createNew = flag('--new')
const dryRun = flag('--dry-run')
const email = (option('--email') ?? (createNew ? DEFAULT_TEST_EMAIL : '')).trim().toLowerCase()
const password = option('--password') ?? `Dev-${randomBytes(12).toString('base64url')}`

function fail(message) {
  console.error(`✖ ${message}`)
  process.exit(1)
}

if (!createNew && !email) fail('Pass --email <address> (an existing account) or --new.')
if (password.length < 8) fail('The password must be at least 8 characters.')

const root = join(import.meta.dirname, '..')
const env = {}
for (const name of ['.env', '.env.local']) {
  const file = join(root, name)
  if (existsSync(file)) Object.assign(env, parseEnv(readFileSync(file, 'utf8')))
}
if (process.env.VERCEL) fail('Refusing to run on Vercel.')
if (env.FIREBASE_ADMIN_PROJECT_ID !== DEV_PROJECT_ID || env.NEXT_PUBLIC_FIREBASE_PROJECT_ID !== DEV_PROJECT_ID) {
  fail(`Refusing: the env files point at ${env.FIREBASE_ADMIN_PROJECT_ID ?? 'no project'}, not ${DEV_PROJECT_ID}.`)
}
if (!env.FIREBASE_ADMIN_CLIENT_EMAIL?.toLowerCase().endsWith(`@${DEV_PROJECT_ID}.iam.gserviceaccount.com`)) {
  fail(`Refusing: FIREBASE_ADMIN_CLIENT_EMAIL isn't a ${DEV_PROJECT_ID} service account.`)
}

const app = initializeApp({
  credential: cert({
    projectId: env.FIREBASE_ADMIN_PROJECT_ID,
    clientEmail: env.FIREBASE_ADMIN_CLIENT_EMAIL,
    privateKey: env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  }),
})
const auth = getAuth(app)
const db = getFirestore(app)

const existing = await auth.getUserByEmail(email).catch((err) => {
  if (err?.code === 'auth/user-not-found') return null
  throw err
})

if (existing && (await db.collection('businesses').doc(existing.uid).get()).exists) {
  fail(`${email} is a business login; this script only sets up customers.`)
}

const prefix = dryRun ? '[dry run] would' : '✔'
if (!createNew) {
  if (!existing) fail(`No ${DEV_PROJECT_ID} account uses ${email}. Use --new to create one.`)
  const methods = existing.providerData.map((p) => p.providerId).join(', ') || 'none'
  if (!dryRun) await auth.updateUser(existing.uid, { password })
  console.log(`${prefix} set a password on ${email} (sign-in methods before: ${methods})`)
  if (!existing.emailVerified) console.warn('! This account is not verified, so the app will still refuse it.')
} else if (existing) {
  if (!dryRun) await auth.updateUser(existing.uid, { password, emailVerified: true })
  console.log(`${prefix} reset the password of the existing test customer ${email}`)
} else {
  if (!dryRun) {
    const user = await auth.createUser({ email, password, emailVerified: true, displayName: 'QA Customer' })
    // The same profile as a real sign-up (app/api/auth/send-verification),
    // with the onboarding wizard marked done so the app opens on the tabs.
    await db.collection('users').doc(user.uid).create({
      email,
      firstName: 'QA',
      lastName: 'Customer',
      displayName: 'QA Customer',
      phone: '',
      customerType: '',
      wishlistOfferIds: [],
      preferredLanguage: 'en',
      notificationsOptIn: false,
      agreedToTerms: true,
      isAgeConfirmed: true,
      termsAgreedAt: FieldValue.serverTimestamp(),
      onboardingCompletedAt: FieldValue.serverTimestamp(),
      createdAt: FieldValue.serverTimestamp(),
    })
  }
  console.log(`${prefix} create the verified test customer ${email}`)
}

console.log(`\n  Project:  ${DEV_PROJECT_ID}\n  Email:    ${email}\n  Password: ${password}\n`)

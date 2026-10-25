import 'server-only'
import { cert, getApps, initializeApp, type App } from 'firebase-admin/app'
import { getAuth, type Auth } from 'firebase-admin/auth'
import { getFirestore, type Firestore } from 'firebase-admin/firestore'
import { getStorage } from 'firebase-admin/storage'
import { assertAdminCredentials, currentFirebaseDeployTarget } from './envGuard'

// Service-account credentials bypass every Firestore Security Rule -- this
// file must never be imported by client code. The 'server-only' import
// above makes an accidental client import a build-time error.
//
// Initialization is lazy (only on first getAdminAuth()/getAdminDb() call,
// not on import) so that routes can check the admin password *before*
// touching this module's credentials -- otherwise merely importing this
// file would throw whenever FIREBASE_ADMIN_* isn't configured yet, turning
// every request (including ones that should cleanly 401) into a 500.
let app: App | undefined
const DEFAULT_APP_NAME = '[DEFAULT]'

function getAdminApp(): App {
  if (!app) {
    const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID
    const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL
    // Env files can't hold real newlines, so the key is stored with
    // literal "\n" escapes and restored here.
    const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n')
    assertAdminCredentials({
      projectId,
      clientEmail,
      privateKey,
      clientProjectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      target: currentFirebaseDeployTarget(),
    })
    // By name: any other, named app in this process (a library's, or one
    // for another project) must never stand in for this one.
    app =
      getApps().find((existing) => existing.name === DEFAULT_APP_NAME) ??
      initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) })
  }
  return app
}

export function getAdminAuth(): Auth {
  return getAuth(getAdminApp())
}

export function getAdminDb(): Firestore {
  return getFirestore(getAdminApp())
}

/** The Firebase project the Admin service account belongs to (DEV or PROD; see envGuard.ts). */
export function getAdminProjectId(): string {
  getAdminApp()
  return process.env.FIREBASE_ADMIN_PROJECT_ID!
}

/**
 * An OAuth access token for Google Cloud APIs (Cloud Translation), from the
 * same service account. Its scopes include cloud-platform; the account needs
 * the "Cloud Translation API User" role in each project
 * (docs/google-cloud-configuration.md). The SDK caches and refreshes it.
 */
export async function getAdminAccessToken(): Promise<string> {
  const credential = getAdminApp().options.credential
  if (!credential) throw new Error('Firebase Admin has no credential.')
  return (await credential.getAccessToken()).access_token
}

/** The project's default Storage bucket (NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET, checked by the env guard). */
export function getAdminBucket() {
  const name = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
  if (!name) throw new Error('NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET is not set.')
  return getStorage(getAdminApp()).bucket(name)
}

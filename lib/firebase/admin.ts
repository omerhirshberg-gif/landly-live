import 'server-only'
import { cert, getApps, initializeApp, type App } from 'firebase-admin/app'
import { getAuth, type Auth } from 'firebase-admin/auth'
import { getFirestore, type Firestore } from 'firebase-admin/firestore'

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

function getAdminApp(): App {
  if (!app) {
    app = getApps().length
      ? getApps()[0]!
      : initializeApp({
          credential: cert({
            projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
            clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
            // Env files can't hold real newlines, so the key is stored with
            // literal "\n" escapes and restored here.
            privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n'),
          }),
        })
  }
  return app
}

export function getAdminAuth(): Auth {
  return getAuth(getAdminApp())
}

export function getAdminDb(): Firestore {
  return getFirestore(getAdminApp())
}

import { getApps, initializeApp } from 'firebase/app'
import { getAuth, GoogleAuthProvider, OAuthProvider } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'
import { getStorage } from 'firebase/storage'
import { currentAuthDomain } from './authDomain'
import { assertFirebaseConfigConsistent, assertFirebaseProjectForTarget, currentFirebaseDeployTarget } from './envGuard'

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  // Our own host on production (first-party auth helper), else the env value.
  authDomain: currentAuthDomain(),
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
}

const deployTarget = currentFirebaseDeployTarget()
assertFirebaseProjectForTarget(firebaseConfig.projectId, deployTarget)
// The env authDomain, not firebaseConfig's: on our own host that one is the host itself.
assertFirebaseConfigConsistent(
  { ...firebaseConfig, authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN },
  deployTarget,
)

const app = getApps().length ? getApps()[0]! : initializeApp(firebaseConfig)

export const auth = getAuth(app)
export const db = getFirestore(app)
// Member avatars (avatars/{uid}, see storage.rules).
export const storage = getStorage(app)
export const googleProvider = new GoogleAuthProvider()
// Sign in with Apple. The name is only ever sent on the first authorization
// (lib/auth/appleName.ts); native iOS builds its credential from the system
// sheet instead (landly-mobile/src/auth/appleSignIn.ts).
export const appleProvider = new OAuthProvider('apple.com')
appleProvider.addScope('email')
appleProvider.addScope('name')

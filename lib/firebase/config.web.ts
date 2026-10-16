import Constants from 'expo-constants'
import { getApp, getApps, initializeApp, type FirebaseOptions } from 'firebase/app'
import * as firebaseAuth from 'firebase/auth'
import { getAuth, GoogleAuthProvider } from 'firebase/auth'
import type * as BrowserAuth from '@firebase/auth/dist/auth-public'
import { getFirestore } from 'firebase/firestore'
import { getStorage } from 'firebase/storage'

// Expo web counterpart of ./config.ts (landly-mobile run in a browser) --
// Metro picks this file over config.ts for platform=web, Next.js never sees
// it. Expo only inlines EXPO_PUBLIC_* env vars, so config.ts's
// NEXT_PUBLIC_* reads would be undefined here; instead, like
// config.native.ts, it takes the same root-.env values via
// landly-mobile/app.config.js. getAuth's browser default
// (IndexedDB) already persists the session across reloads.
const firebaseConfig = Constants.expoConfig?.extra?.firebase as FirebaseOptions | undefined
if (!firebaseConfig?.apiKey || !firebaseConfig.projectId) {
  throw new Error('Firebase config missing — see landly-mobile/app.config.js')
}

const app = getApps().length ? getApp() : initializeApp(firebaseConfig)

// "Remember me" on the login screen switches between this and in-memory, as
// on native. (landly-mobile's tsconfig types firebase/auth as its React
// Native build, which lacks the browser persistences this bundle has.)
export const devicePersistence = (firebaseAuth as unknown as typeof BrowserAuth).browserLocalPersistence
export const auth = getAuth(app)
export const db = getFirestore(app)
// Member avatars (avatars/{uid}, see storage.rules).
export const storage = getStorage(app)
export const googleProvider = new GoogleAuthProvider()

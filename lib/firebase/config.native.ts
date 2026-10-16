import AsyncStorage from '@react-native-async-storage/async-storage'
import Constants from 'expo-constants'
import { getApp, getApps, initializeApp, type FirebaseOptions } from 'firebase/app'
import { getAuth, getReactNativePersistence, GoogleAuthProvider, initializeAuth } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'
import { getStorage } from 'firebase/storage'

// React Native counterpart of ./config.ts — Metro picks this file over
// config.ts on iOS/Android, Next.js never sees it. Same exports, same
// Firebase project: landly-mobile/app.config.js fills `extra.firebase` from
// the repo-root .env's NEXT_PUBLIC_FIREBASE_* values, so web and mobile
// can't point at different environments.
const firebaseConfig = Constants.expoConfig?.extra?.firebase as FirebaseOptions | undefined
if (!firebaseConfig?.apiKey || !firebaseConfig.projectId) {
  throw new Error('Firebase config missing — see landly-mobile/app.config.js')
}

const isFirstInit = getApps().length === 0
const app = isFirstInit ? initializeApp(firebaseConfig) : getApp()

// The web SDK's default persistence is in-memory on React Native, which
// would log the user out on every app restart. initializeAuth may only run
// once per app, so a fast-refresh re-evaluation reuses the existing instance.
// The same persistence instance is exported so "Remember me" can switch back
// to it after a session-only (in-memory) sign-in.
export const devicePersistence = getReactNativePersistence(AsyncStorage)
export const auth = isFirstInit ? initializeAuth(app, { persistence: devicePersistence }) : getAuth(app)
export const db = getFirestore(app)
// Member avatars (avatars/{uid}, see storage.rules).
export const storage = getStorage(app)
export const googleProvider = new GoogleAuthProvider()

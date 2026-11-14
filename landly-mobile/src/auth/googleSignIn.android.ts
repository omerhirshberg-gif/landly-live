import Constants from 'expo-constants'
import { FirebaseError } from 'firebase/app'
import { GoogleAuthProvider, signInWithCredential } from 'firebase/auth'
import { GoogleSignin, statusCodes } from '@react-native-google-signin/google-signin'
import { finishCustomerGoogleSignIn, type CustomerSignInResult } from '@shared/auth/signInCustomer'
import { auth } from '@shared/firebase/config'
import type { Lang } from '@shared/i18n/translations'

// Android's "Continue with Google" (Metro picks this over googleSignIn.ts, the
// iOS browser flow, and googleSignIn.web.ts, the Firebase popup). Google's own
// account sheet opens in the app, with no browser and no custom URI scheme:
// the SDK identifies the app by its package name and signing SHA-1, registered
// on an Android OAuth client in the same Google Cloud project as the Firebase
// app, and hands back an ID token for the project's *web* client
// (EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID, via app.config.js). That token becomes a
// Firebase credential, and from there it's the same shared customer rules as
// every other sign-in. Each Firebase project (landly-dev, landly-be752) needs
// its own web client ID, and every key that signs a build needs its SHA-1 on
// that project's Android client.

const webClientId: string | undefined = Constants.expoConfig?.extra?.googleClientIds?.web

/** The button always shows; this says whether tapping it can work (false until the web client ID is set). */
export const GOOGLE_SIGN_IN_CONFIGURED = !!webClientId

let configured = false

/** The failure codes login.tsx already says in the member's language (lib/firebase/authErrors.ts). */
function translate(err: unknown): FirebaseError {
  const code = (err as { code?: unknown } | null)?.code
  if (code === statusCodes.SIGN_IN_CANCELLED) return new FirebaseError('auth/popup-closed-by-user', 'Google sign-in was cancelled')
  if (code === statusCodes.IN_PROGRESS) return new FirebaseError('auth/cancelled-popup-request', 'Google sign-in is already in progress')
  if (code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
    return new FirebaseError('auth/google-play-services-unavailable', 'Google Play services is not available')
  }
  return new FirebaseError('auth/internal-error', 'Google sign-in failed')
}

/** Throws a Firebase-style 'auth/popup-closed-by-user' when the user backs out. */
export async function signInWithGoogle(currentLang: Lang): Promise<CustomerSignInResult> {
  if (!webClientId) throw new Error('Google sign-in is not configured for this platform')
  let idToken: string | null
  try {
    if (!configured) {
      GoogleSignin.configure({ webClientId })
      configured = true
    }
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true })
    const response = await GoogleSignin.signIn()
    if (response.type !== 'success') throw new FirebaseError('auth/popup-closed-by-user', 'Google sign-in was cancelled')
    idToken = response.data.idToken
  } catch (err) {
    throw err instanceof FirebaseError ? err : translate(err)
  }
  if (!idToken) throw new FirebaseError('auth/internal-error', 'Google returned no ID token')
  return signInWithGoogleIdToken(idToken, currentLang)
}

export async function signInWithGoogleIdToken(idToken: string, currentLang: Lang): Promise<CustomerSignInResult> {
  const cred = await signInWithCredential(auth, GoogleAuthProvider.credential(idToken))
  return finishCustomerGoogleSignIn(cred, currentLang)
}

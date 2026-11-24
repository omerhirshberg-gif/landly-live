import Constants from 'expo-constants'
import { FirebaseError } from 'firebase/app'
import { GoogleAuthProvider, signInWithCredential } from 'firebase/auth'
import { GoogleSignin, statusCodes } from '@react-native-google-signin/google-signin'
import { translateGoogleNativeError } from './googleSignInErrors'
import { withGoogleClientHint } from '@shared/auth/googleClientHint'
import { nativeBuildInfo } from './nativeBuildInfo'
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

// Configured once, when the module loads, so the sheet never opens on a
// half-initialised SDK. No scopes beyond the default (email, profile).
if (webClientId) GoogleSignin.configure({ webClientId })

/** Throws a Firebase-style 'auth/popup-closed-by-user' when the user backs out. */
export async function signInWithGoogle(currentLang: Lang): Promise<CustomerSignInResult> {
  if (!webClientId) throw new Error('Google sign-in is not configured for this platform')
  let idToken: string | null
  try {
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true })
    const response = await GoogleSignin.signIn()
    if (response.type !== 'success') throw new FirebaseError('auth/popup-closed-by-user', 'Google sign-in was cancelled')
    idToken = response.data.idToken
  } catch (err) {
    // Every failure carries the masked web client ID this build was baked with, so a device screenshot names it.
    throw withGoogleClientHint(err instanceof FirebaseError ? err : translateGoogleNativeError(err, statusCodes), webClientId, nativeBuildInfo())
  }
  if (!idToken) throw withGoogleClientHint(new FirebaseError('auth/internal-error', 'Google returned no ID token'), webClientId, nativeBuildInfo())
  return signInWithGoogleIdToken(idToken, currentLang)
}

export async function signInWithGoogleIdToken(idToken: string, currentLang: Lang): Promise<CustomerSignInResult> {
  let cred
  try {
    cred = await signInWithCredential(auth, GoogleAuthProvider.credential(idToken))
  } catch (err) {
    // Firebase refused Google's token (its message says why, e.g. a web client
    // from another project). Logged here so it can't be mistaken for a native failure.
    console.warn('[auth] Firebase rejected the Google credential:', (err as { code?: unknown } | null)?.code)
    throw err instanceof Error ? withGoogleClientHint(err, webClientId, nativeBuildInfo()) : err
  }
  return finishCustomerGoogleSignIn(cred, currentLang)
}

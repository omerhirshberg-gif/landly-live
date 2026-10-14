import { Platform } from 'react-native'
import Constants from 'expo-constants'
import * as AuthSession from 'expo-auth-session'
import * as WebBrowser from 'expo-web-browser'
import { FirebaseError } from 'firebase/app'
import { GoogleAuthProvider, signInWithCredential } from 'firebase/auth'
import { finishCustomerGoogleSignIn, type CustomerSignInResult } from '@shared/auth/signInCustomer'
import { auth } from '@shared/firebase/config'
import type { Lang } from '@shared/i18n/translations'

// Native "Continue with Google" (the browser build, googleSignIn.web.ts, uses
// the Firebase popup instead). Google's OAuth page opens in the system
// browser sheet (PKCE code flow), the returned ID token becomes a Firebase
// credential, and from there it's the same shared customer rules the web
// /login page runs (business rejection, customer doc, preferred language).
//
// Needs, per platform, an OAuth client in the same Google Cloud project as
// the Firebase app: EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID and
// EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID (Android: enable "custom URI scheme"
// on the client). app.config.js registers each client's reversed ID as a URL
// scheme, so the redirect only reaches a development or store build — not
// Expo Go.

WebBrowser.maybeCompleteAuthSession()

const clientIds: { ios?: string; android?: string } = Constants.expoConfig?.extra?.googleClientIds ?? {}
const clientId = Platform.OS === 'ios' ? clientIds.ios : Platform.OS === 'android' ? clientIds.android : undefined

/** The button always shows; this says whether tapping it can work (false until this platform's client ID is set). */
export const GOOGLE_SIGN_IN_CONFIGURED = !!clientId

const discovery = {
  authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
  tokenEndpoint: 'https://oauth2.googleapis.com/token',
}

// "123-abc.apps.googleusercontent.com" -> "com.googleusercontent.apps.123-abc"
function reversedClientId(id: string): string {
  return id.split('.').reverse().join('.')
}

/** Throws a Firebase-style 'auth/popup-closed-by-user' when the user backs out. */
export async function signInWithGoogle(currentLang: Lang): Promise<CustomerSignInResult> {
  if (!clientId) throw new Error('Google sign-in is not configured for this platform')
  const redirectUri = `${reversedClientId(clientId)}:/oauthredirect`
  const request = new AuthSession.AuthRequest({
    clientId,
    redirectUri,
    scopes: ['openid', 'profile', 'email'],
    responseType: AuthSession.ResponseType.Code,
    usePKCE: true,
    extraParams: { prompt: 'select_account' },
  })
  const result = await request.promptAsync(discovery)
  if (result.type !== 'success') throw new FirebaseError('auth/popup-closed-by-user', 'Google sign-in was cancelled')

  const tokens = await AuthSession.exchangeCodeAsync(
    { clientId, redirectUri, code: result.params.code, extraParams: { code_verifier: request.codeVerifier ?? '' } },
    discovery
  )
  if (!tokens.idToken) throw new Error('Google returned no ID token')
  return signInWithGoogleIdToken(tokens.idToken, currentLang)
}

export async function signInWithGoogleIdToken(idToken: string, currentLang: Lang): Promise<CustomerSignInResult> {
  const cred = await signInWithCredential(auth, GoogleAuthProvider.credential(idToken))
  return finishCustomerGoogleSignIn(cred, currentLang)
}

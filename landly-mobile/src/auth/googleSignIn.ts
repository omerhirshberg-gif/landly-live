import Constants from 'expo-constants'
import * as AuthSession from 'expo-auth-session'
import * as WebBrowser from 'expo-web-browser'
import { FirebaseError } from 'firebase/app'
import { GoogleAuthProvider, signInWithCredential } from 'firebase/auth'
import { finishCustomerGoogleSignIn, type CustomerSignInResult } from '@shared/auth/signInCustomer'
import { auth } from '@shared/firebase/config'
import type { Lang } from '@shared/i18n/translations'
import { withGoogleClientHint } from '@shared/auth/googleClientHint'
import { nativeBuildInfo } from './nativeBuildInfo'

// iOS "Continue with Google" (Android is googleSignIn.android.ts, the native
// Google sheet; the browser build, googleSignIn.web.ts, uses the Firebase
// popup). Google's OAuth page opens in the system
// browser sheet (PKCE code flow), the returned ID token becomes a Firebase
// credential, and from there it's the same shared customer rules the web
// /login page runs (business rejection, customer doc, preferred language).
//
// Needs an iOS OAuth client in the same Google Cloud project as the Firebase
// app: EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID. app.config.js registers its reversed
// ID as a URL scheme, so the redirect only reaches a development or store
// build — not Expo Go.

WebBrowser.maybeCompleteAuthSession()

const clientId: string | undefined = Constants.expoConfig?.extra?.googleClientIds?.ios

/** The button always shows; this says whether tapping it can work (false until the iOS client ID is set). */
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
  // Every failure carries the masked iOS client ID this build was baked with, so a device screenshot names it.
  const tag = <T extends Error>(err: T): T => withGoogleClientHint(err, clientId, nativeBuildInfo())
  const result = await request.promptAsync(discovery)
  if (result.type === 'error') {
    // Google redirected back with an OAuth error (e.g. invalid_client, redirect_uri_mismatch).
    const reason = String(result.params?.error ?? result.error?.code ?? 'unknown').match(/^[a-z_]{1,40}$/i)?.[0] ?? 'unknown'
    throw tag(new FirebaseError('auth/invalid-credential', `Google refused the sign-in (${reason})`))
  }
  if (result.type !== 'success') throw new FirebaseError('auth/popup-closed-by-user', 'Google sign-in was cancelled')

  let tokens
  try {
    tokens = await AuthSession.exchangeCodeAsync(
      { clientId, redirectUri, code: result.params.code, extraParams: { code_verifier: request.codeVerifier ?? '' } },
      discovery
    )
  } catch (err) {
    // Google's token endpoint answers with an OAuth error name (invalid_client, invalid_grant, ...).
    const reason = String((err as { code?: unknown } | null)?.code ?? '').match(/^[a-z_]{1,40}$/i)?.[0]
    throw tag(new FirebaseError('auth/invalid-credential', `Google token exchange failed${reason ? ` (${reason})` : ''}`))
  }
  if (!tokens.idToken) throw tag(new FirebaseError('auth/internal-error', 'Google returned no ID token'))
  return signInWithGoogleIdToken(tokens.idToken, currentLang)
}

export async function signInWithGoogleIdToken(idToken: string, currentLang: Lang): Promise<CustomerSignInResult> {
  let cred
  try {
    cred = await signInWithCredential(auth, GoogleAuthProvider.credential(idToken))
  } catch (err) {
    // Firebase refused Google's token (e.g. an ID token minted for a client of another project).
    throw err instanceof Error ? withGoogleClientHint(err, clientId, nativeBuildInfo()) : err
  }
  return finishCustomerGoogleSignIn(cred, currentLang)
}

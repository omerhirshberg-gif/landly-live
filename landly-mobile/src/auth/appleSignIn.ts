import { Platform } from 'react-native'
import * as AppleAuthentication from 'expo-apple-authentication'
import * as Crypto from 'expo-crypto'
import { FirebaseError } from 'firebase/app'
import { OAuthProvider, signInWithCredential } from 'firebase/auth'
import { appleNamesFromNative } from '@shared/auth/appleName'
import { finishCustomerOAuthSignIn, type CustomerSignInResult } from '@shared/auth/signInCustomer'
import { auth } from '@shared/firebase/config'
import type { Lang } from '@shared/i18n/translations'

// Native "Continue with Apple" (the browser build, appleSignIn.web.ts, uses
// the Firebase popup instead). iOS only: the system sheet (Face ID / Touch
// ID) returns an Apple identity token, which becomes a Firebase credential,
// and from there it's the same shared customer rules as Google. Android has
// no Apple sheet, so the button isn't shown there at all.
//
// Needs the "Sign in with Apple" entitlement (app.json ios.usesAppleSignIn),
// so it only works in a development or store build -- not Expo Go -- and the
// Firebase project's Apple provider must accept the bundle ID
// (com.amitbd.landlyapp) on both landly-dev and landly-be752.

/** Whether to show the button: iOS 13+ with the entitlement; never Android. */
export async function isAppleSignInAvailable(): Promise<boolean> {
  if (Platform.OS !== 'ios') return false
  return AppleAuthentication.isAvailableAsync().catch(() => false)
}

function randomNonce(): string {
  return Array.from(Crypto.getRandomBytes(32), (b) => b.toString(16).padStart(2, '0')).join('')
}

/** Throws a Firebase-style 'auth/popup-closed-by-user' when the user backs out. */
export async function signInWithApple(currentLang: Lang): Promise<CustomerSignInResult> {
  // Apple signs the SHA-256 of the nonce into the token; Firebase checks it
  // against the raw one, so a token can't be replayed from elsewhere.
  const rawNonce = randomNonce()
  const hashedNonce = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, rawNonce)
  let apple: AppleAuthentication.AppleAuthenticationCredential
  try {
    apple = await AppleAuthentication.signInAsync({
      requestedScopes: [AppleAuthentication.AppleAuthenticationScope.FULL_NAME, AppleAuthentication.AppleAuthenticationScope.EMAIL],
      nonce: hashedNonce,
    })
  } catch (err) {
    if ((err as { code?: unknown } | null)?.code === 'ERR_REQUEST_CANCELED') {
      throw new FirebaseError('auth/popup-closed-by-user', 'Apple sign-in was cancelled')
    }
    throw err
  }
  if (!apple.identityToken) throw new Error('Apple returned no identity token')
  const credential = new OAuthProvider('apple.com').credential({ idToken: apple.identityToken, rawNonce })
  const cred = await signInWithCredential(auth, credential)
  // fullName is only filled on the first authorization (lib/auth/appleName.ts).
  return finishCustomerOAuthSignIn(cred, currentLang, { names: appleNamesFromNative(apple.fullName) })
}
